import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 文章模型
 *
 * - title/excerpt/content 为必填（content 供详情页渲染正文）
 * - tags 字符串数组，用于列表页标签筛选
 * - cover 封面图 URL（可选，配合 /api/upload 使用）
 * - author* 文章作者（创建时记录；旧数据可能为空）
 * - likedBy / favoritedBy 点赞者、收藏者标识数组（"role:id"），用于去重与计数
 * - timestamps 自动维护 createdAt / updatedAt
 */

/** 作者类型 */
export type ArticleAuthorType = 'user' | 'admin';

/** Article 文档字段 */
export interface ArticleDoc {
  _id: Types.ObjectId;
  title: string;
  excerpt: string;
  content: string;
  /** 服务端编译并消毒后的正文 HTML（渲染端直接展示，不执行 JSX） */
  contentHtml: string;
  tags: string[];
  cover?: string;
  authorType?: ArticleAuthorType;
  authorId?: Types.ObjectId;
  authorName?: string;
  likedBy: string[];
  favoritedBy: string[];
  /** 点赞数（冗余计数，由 toggle 接口 $inc 原子维护，避免读大数组算 length） */
  likes: number;
  /** 收藏数（冗余计数） */
  favorites: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ArticleModel = Model<ArticleDoc>;

const articleSchema = new Schema<ArticleDoc, ArticleModel>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    excerpt: { type: String, required: true, trim: true, maxlength: 500 },
    content: { type: String, required: true, maxlength: 200 * 1024 },
    contentHtml: { type: String, default: '' },
    tags: { type: [String], default: [] },
    cover: { type: String, default: '' },
    authorType: { type: String, enum: ['user', 'admin'], default: undefined },
    authorId: { type: Schema.Types.ObjectId, default: undefined },
    authorName: { type: String, trim: true, maxlength: 32, default: undefined },
    likedBy: { type: [String], default: [] },
    favoritedBy: { type: [String], default: [] },
    // 冗余计数：点赞/收藏接口用 $inc 原子维护；列表页不再读取大数组
    likes: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// 列表按发布时间倒序查询走索引
articleSchema.index({ createdAt: -1 });
// 标签筛选索引
articleSchema.index({ tags: 1 });
// 我的收藏列表
articleSchema.index({ favoritedBy: 1, createdAt: -1 });

export const Article = model<ArticleDoc, ArticleModel>('Article', articleSchema);
