import { model, Schema, Types, type Model } from 'mongoose';

import type { SiteContentKey, SiteContentValue } from '../types/siteContent.js';
import { SITE_CONTENT_KEYS } from '../types/siteContent.js';

/**
 * 站点内容模型（简历页 / 首页展示内容的持久化）
 *
 * - key 唯一索引，一 key 一条记录
 * - value 以 Mixed 存储各内容的 JSON（教育背景 / 专业技能 / 项目经历 / 个人评价 / 精选项目）
 * - 由 service 在启动时 seed 默认值，管理员通过 /api/site-content 增删改
 */

/** SiteContent 文档字段 */
export interface SiteContentDoc {
  _id: Types.ObjectId;
  key: SiteContentKey;
  value: SiteContentValue;
  createdAt: Date;
  updatedAt: Date;
}

export type SiteContentModel = Model<SiteContentDoc>;

const siteContentSchema = new Schema<SiteContentDoc, SiteContentModel>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: SITE_CONTENT_KEYS,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
);

export const SiteContent = model<SiteContentDoc, SiteContentModel>('SiteContent', siteContentSchema);
