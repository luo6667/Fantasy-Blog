import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 标签模型（分类标签库）
 *
 * - name 唯一索引，作为分类标签的权威来源
 * - 文章创建/更新时从标签库中选择，管理员可增删
 * - 删除标签时同时从所有文章移除该标签（见 tag.service）
 */

/** Tag 文档字段 */
export interface TagDoc {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TagModel = Model<TagDoc>;

const tagSchema = new Schema<TagDoc, TagModel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 1,
      maxlength: 32,
    },
  },
  { timestamps: true },
);

export const Tag = model<TagDoc, TagModel>('Tag', tagSchema);
