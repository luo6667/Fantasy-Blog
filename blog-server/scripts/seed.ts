/**
 * 种子脚本（npm run seed）
 *
 * 1. 确保管理员账号 admin 存在：
 *    - 不存在时创建，密码取环境变量 ADMIN_INITIAL_PASSWORD（未设置则随机生成并打印）
 *    - 已存在时不重置密码（避免覆盖已修改的密码）；
 *      仅当显式设置了 ADMIN_INITIAL_PASSWORD 时按该值重置
 * 2. 把现有文章里用到的标签同步进标签库（Tag 集合）
 *
 * 运行方式：cd blog-server && npm run seed
 */
import '../src/load-env.js';

import { randomBytes } from 'node:crypto';

import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { Admin } from '../src/models/Admin.js';
import { Article } from '../src/models/Article.js';
import { Tag } from '../src/models/Tag.js';

const ADMIN_USERNAME = 'admin';

/** 确保管理员存在（不再使用固定弱口令 123456） */
async function seedAdmin(): Promise<void> {
  const admin = await Admin.findOne({ username: ADMIN_USERNAME }).select('+password');
  if (!admin) {
    const password = env.ADMIN_INITIAL_PASSWORD ?? randomBytes(12).toString('hex');
    await Admin.create({ username: ADMIN_USERNAME, password });
    console.log(`✔ 创建管理员 ${ADMIN_USERNAME}`);
    if (env.ADMIN_INITIAL_PASSWORD) {
      console.log('  初始密码来自环境变量 ADMIN_INITIAL_PASSWORD');
    } else {
      console.log(`  初始密码（随机生成，请立即保存并登录后修改）：${password}`);
    }
    return;
  }
  if (env.ADMIN_INITIAL_PASSWORD) {
    admin.password = env.ADMIN_INITIAL_PASSWORD;
    await admin.save();
    console.log(`✔ 已按 ADMIN_INITIAL_PASSWORD 重置管理员 ${ADMIN_USERNAME} 的密码`);
  } else {
    console.log(
      `✔ 管理员 ${ADMIN_USERNAME} 已存在，跳过（如需重置密码，设置 ADMIN_INITIAL_PASSWORD 后重跑）`,
    );
  }
}

/** 把现有文章标签同步进标签库 */
async function seedTags(): Promise<void> {
  const articleTags = (await Article.distinct('tags')) as string[];
  const existing = new Set((await Tag.find().select('name').lean()).map((t) => t.name));
  let added = 0;
  for (const name of articleTags) {
    if (name && !existing.has(name)) {
      await Tag.create({ name });
      added += 1;
    }
  }
  console.log(`✔ 标签库：新增 ${added} 个，共 ${await Tag.countDocuments()} 个`);
}

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  await seedAdmin();
  await seedTags();
  await mongoose.disconnect();
  console.log('Seed 完成');
}

main().catch((err: unknown) => {
  console.error('Seed 失败:', err);
  process.exit(1);
});
