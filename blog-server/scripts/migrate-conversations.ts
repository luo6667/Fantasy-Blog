/**
 * 会话数据迁移脚本（npm run migrate）
 *
 * 修复旧版本在 conversations.participants（数组字段）上的唯一索引导致的
 * 「一个用户只能和一个对象聊天」问题。幂等，可重复执行。
 *
 * 运行方式：cd blog-server && npm run migrate
 */
import '../src/load-env.js';

import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { migrateConversations } from '../src/db/migrate.js';

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  await migrateConversations();
  await mongoose.disconnect();
  console.log('✔ 会话数据迁移完成');
}

main().catch((err: unknown) => {
  console.error('会话数据迁移失败:', err);
  process.exit(1);
});
