import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 文章模型
 *
 * - title/excerpt/content 为必填（content 供详情页渲染正文）
 * - tags 字符串数组，用于列表页标签筛选
 * - cover 封面图 URL（可选，配合 /api/upload 使用）
 * - timestamps 自动维护 createdAt / updatedAt
 */

/** Article 文档字段 */
export interface ArticleDoc {
  _id: Types.ObjectId;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  cover?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ArticleModel = Model<ArticleDoc>;

const articleSchema = new Schema<ArticleDoc, ArticleModel>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    excerpt: { type: String, required: true, trim: true, maxlength: 500 },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    cover: { type: String, default: '' },
  },
  { timestamps: true },
);

// 列表按发布时间倒序查询走索引
articleSchema.index({ createdAt: -1 });
// 标签筛选索引
articleSchema.index({ tags: 1 });

export const Article = model<ArticleDoc, ArticleModel>('Article', articleSchema);
