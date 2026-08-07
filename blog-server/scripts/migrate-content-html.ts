/**
 * 一次性迁移脚本：为所有现有文章生成 contentHtml（服务端编译 + 消毒）
 *
 * 运行方式：cd blog-server && npx tsx scripts/migrate-content-html.ts
 */
import '../src/load-env.js';

import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { Article } from '../src/models/Article.js';
import { mdxToSafeHtml } from '../src/utils/mdx.js';

await mongoose.connect(env.MONGODB_URI);

const docs = await Article.find().select('_id content contentHtml').lean();
let updated = 0;
let failed = 0;

for (const d of docs) {
  try {
    const html = await mdxToSafeHtml(d.content);
    if (html !== (d.contentHtml ?? '')) {
      await Article.updateOne({ _id: d._id }, { $set: { contentHtml: html } });
      updated += 1;
    }
  } catch (err) {
    failed += 1;
    console.error(`✖ 文章 ${d._id.toString()} 编译失败:`, err instanceof Error ? err.message : err);
  }
}

console.log(`✔ 共 ${docs.length} 篇文章，更新 ${updated} 篇 contentHtml，失败 ${failed} 篇`);
await mongoose.disconnect();
