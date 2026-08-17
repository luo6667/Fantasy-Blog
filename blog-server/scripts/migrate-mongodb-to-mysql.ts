/**
 * 数据迁移脚本（npm run migrate）
 *
 * 把旧 MongoDB（env.MONGODB_URI）中的全部集合数据迁移到 MySQL（jianli 库）。
 *
 * - 幂等：目标表已有数据时跳过该表；追加 --force 可清空目标表后重导
 * - 主键沿用旧 _id（24 位 hex 字符串），引用字段（article→articleId 等）原样保留，
 *   已签发的 JWT、前端存储的 id 均无需变更
 * - 数组字段（tags / likedBy / favoritedBy / participants）与 SiteContent.value
 *   直接以 JSON 形式写入 MySQL JSON 列
 *
 * 运行方式：cd blog-server && npm run migrate [--force]
 */
import '../src/load-env.js';

import { MongoClient, ObjectId, type Document } from 'mongodb';
import type { ModelCtor } from 'sequelize';

import { env } from '../src/config/env.js';
import { ensureDatabase, sequelize } from '../src/db/sequelize.js';
import Admin from '../src/models/Admin.js';
import AiConfig from '../src/models/AiConfig.js';
import Article from '../src/models/Article.js';
import Comment from '../src/models/Comment.js';
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import Notification from '../src/models/Notification.js';
import SiteContent from '../src/models/SiteContent.js';
import Tag from '../src/models/Tag.js';
import User from '../src/models/User.js';

/** 集合 → MySQL 模型映射（集合名与 mongoose 默认复数化结果一致） */
const TABLES: { collection: string; model: ModelCtor<never>; label: string }[] = [
  { collection: 'admins', model: Admin as unknown as ModelCtor<never>, label: '管理员' },
  { collection: 'users', model: User as unknown as ModelCtor<never>, label: '普通用户' },
  { collection: 'articles', model: Article as unknown as ModelCtor<never>, label: '文章' },
  { collection: 'comments', model: Comment as unknown as ModelCtor<never>, label: '评论' },
  { collection: 'conversations', model: Conversation as unknown as ModelCtor<never>, label: '私信会话' },
  { collection: 'messages', model: Message as unknown as ModelCtor<never>, label: '私信消息' },
  { collection: 'notifications', model: Notification as unknown as ModelCtor<never>, label: '通知' },
  { collection: 'tags', model: Tag as unknown as ModelCtor<never>, label: '标签' },
  { collection: 'aiconfigs', model: AiConfig as unknown as ModelCtor<never>, label: 'AI 配置' },
  { collection: 'sitecontents', model: SiteContent as unknown as ModelCtor<never>, label: '站点内容' },
];

/** 旧 MongoDB 字段名 → MySQL 列名（其余字段同名直迁） */
const RENAMED_FIELDS: Record<string, string> = {
  article: 'articleId',
  parent: 'parentId',
  conversation: 'conversationId',
};

/** 递归规范化值：ObjectId → 字符串，Date / 数组 / 嵌套对象原样保留其内部结构 */
function normalize(v: unknown): unknown {
  if (v instanceof ObjectId) return v.toString();
  if (v instanceof Date || v === null) return v;
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = normalize(val);
    }
    return out;
  }
  return v;
}

/** 文档 → 行：_id → id（字符串），引用字段重命名，其余字段递归规范化 */
function toRow(doc: Document): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id') {
      row.id = String(v);
      continue;
    }
    row[RENAMED_FIELDS[k] ?? k] = normalize(v);
  }
  // 为旧数据可能缺失的字段补默认值（MySQL 非空约束），多余的键会被 bulkCreate 忽略
  if (row.tags === undefined) row.tags = [];
  if (row.likedBy === undefined) row.likedBy = [];
  if (row.favoritedBy === undefined) row.favoritedBy = [];
  if (row.participants === undefined) row.participants = [];
  if (row.contentHtml === undefined) row.contentHtml = '';
  if (row.cover === undefined) row.cover = '';
  if (row.read === undefined) row.read = false;
  if (row.likes === undefined) row.likes = 0;
  if (row.favorites === undefined) row.favorites = 0;
  if (row.lastMessage === undefined) row.lastMessage = null;
  return row;
}

async function main(): Promise<void> {
  if (!env.MONGODB_URI) {
    console.error('❌ 未配置 MONGODB_URI（旧 MongoDB 数据源），请在 .env 中设置后重试');
    process.exit(1);
  }
  const force = process.argv.includes('--force');

  console.log('🔗 连接 MongoDB...');
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const mongoDb = client.db();

  console.log('🗄️  准备 MySQL 数据库与表结构...');
  await ensureDatabase();
  await sequelize.sync();

  const summary: { label: string; count: number; skipped: boolean }[] = [];
  for (const { collection, model, label } of TABLES) {
    const col = mongoDb.collection(collection);
    const mongoCount = await col.countDocuments();
    const existing = await (model as unknown as { count(): Promise<number> }).count();

    if (mongoCount === 0) {
      console.log(`⏭️  集合 ${collection}：无数据，跳过`);
      summary.push({ label, count: 0, skipped: true });
      continue;
    }
    if (existing > 0 && !force) {
      console.log(`⏭️  表 ${label} 已有 ${existing} 条数据，跳过（--force 可清空重导）`);
      summary.push({ label, count: existing, skipped: true });
      continue;
    }
    if (force && existing > 0) {
      await (model as unknown as { destroy(opts: { truncate: boolean }): Promise<number> }).destroy({
        truncate: true,
      });
      console.log(`🧹  已清空 ${label} 表（--force）`);
    }

    const docs = await col.find({}).toArray();
    const rows = docs.map(toRow);
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await (model as unknown as { bulkCreate(rows: Record<string, unknown>[]): Promise<unknown> })
        .bulkCreate(rows.slice(i, i + BATCH), { validate: false });
    }
    console.log(`✔  ${label}：迁移 ${rows.length} 条`);
    summary.push({ label, count: rows.length, skipped: false });
  }

  await client.close();
  await sequelize.close();

  console.log('\n📋 迁移汇总：');
  for (const s of summary) {
    console.log(`  - ${s.label}：${s.skipped ? '跳过' : `迁移 ${s.count} 条`}`);
  }
  console.log('\n迁移完成');
}

main().catch((err: unknown) => {
  console.error('迁移失败:', err);
  process.exit(1);
});
