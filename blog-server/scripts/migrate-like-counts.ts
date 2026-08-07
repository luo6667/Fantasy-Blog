/**
 * 一次性迁移脚本：为现有文章初始化 likes / favorites 冗余计数
 * （按当前 likedBy / favoritedBy 数组长度回填）
 *
 * 运行方式：cd blog-server && npx tsx scripts/migrate-like-counts.ts
 */
import '../src/load-env.js';

import mongoose from 'mongoose';

import { env } from '../src/config/env.js';
import { Article } from '../src/models/Article.js';

await mongoose.connect(env.MONGODB_URI);

const result = await Article.updateMany(
  {},
  [
    {
      $set: {
        likes: { $size: { $ifNull: ['$likedBy', []] } },
        favorites: { $size: { $ifNull: ['$favoritedBy', []] } },
      },
    },
  ],
);

console.log(`✔ 已初始化 ${result.modifiedCount} 篇文章的点赞/收藏计数`);
await mongoose.disconnect();
