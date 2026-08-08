import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 评论模型
 *
 * - article：所属文章
 * - parent：父评论（回复时指向一级评论；一级评论为 null）
 * - authorType / authorId / authorName：作者（普通用户或管理员，冗余署名）
 * - likedBy：点赞者标识数组（"user:<id>" / "admin:<id>"），用于去重与取消点赞
 */

/** 作者类型 */
export type CommentAuthorType = 'user' | 'admin';

/** Comment 文档字段 */
export interface CommentDoc {
  _id: Types.ObjectId;
  article: Types.ObjectId;
  parent: Types.ObjectId | null;
  authorType: CommentAuthorType;
  authorId: Types.ObjectId;
  authorName: string;
  content: string;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type CommentModel = Model<CommentDoc>;

const commentSchema = new Schema<CommentDoc, CommentModel>(
  {
    article: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
    authorType: { type: String, enum: ['user', 'admin'], required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    authorName: { type: String, required: true, trim: true, maxlength: 32 },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    likedBy: { type: [String], default: [] },
  },
  { timestamps: true },
);

// 按文章拉取评论（含回复）走索引
commentSchema.index({ article: 1, createdAt: 1 });
// 删除评论时按 parent 清理回复
commentSchema.index({ parent: 1 });
// 删除用户时按作者级联清理评论
commentSchema.index({ authorId: 1, authorType: 1 });

export const Comment = model<CommentDoc, CommentModel>('Comment', commentSchema);
