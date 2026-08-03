/**
 * 种子脚本（npm run seed）
 *
 * 1. 确保管理员账号 admin 存在且密码为 123456（不存在则创建，密码不对则重置）
 * 2. 把现有文章里用到的标签同步进标签库（Tag 集合）
 *
 * 运行方式：cd blog-server && npm run seed
 */
import '../src/load-env.js';

import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { Admin } from '../src/models/Admin.js';
import { Article } from '../src/models/Article.js';
import { Tag } from '../src/models/Tag.js';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123456';

/** 确保 admin/123456 存在 */
async function seedAdmin(): Promise<void> {
  const admin = await Admin.findOne({ username: ADMIN_USERNAME }).select('+password');
  if (!admin) {
    await Admin.create({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    console.log(`✔ 创建管理员 ${ADMIN_USERNAME}（密码 ${ADMIN_PASSWORD}）`);
    return;
  }
  const passwordOk = await admin.comparePassword(ADMIN_PASSWORD);
  if (!passwordOk) {
    admin.password = ADMIN_PASSWORD;
    await admin.save();
    console.log(`✔ 重置管理员 ${ADMIN_USERNAME} 的密码为 ${ADMIN_PASSWORD}`);
  } else {
    console.log(`✔ 管理员 ${ADMIN_USERNAME} 密码正确`);
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
