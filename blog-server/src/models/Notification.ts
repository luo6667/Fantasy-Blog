import { model, Schema, Types, type Model } from 'mongoose';

import type { NotificationType } from '../types/notification.js';

/**
 * 通知模型
 *
 * 由评论文章、回复评论、收藏文章等行为自动生成：
 * - recipient：接收者（普通用户或管理员）
 * - actor：触发者
 * - read 标记是否已读；列表按时间倒序
 */
export interface NotificationDoc {
  _id: Types.ObjectId;
  recipientType: 'user' | 'admin';
  recipientId: Types.ObjectId;
  type: NotificationType;
  actorType: 'user' | 'admin';
  actorId: Types.ObjectId;
  actorName: string;
  articleId?: Types.ObjectId;
  articleTitle?: string;
  commentId?: Types.ObjectId;
  commentContent?: string;
  read: boolean;
  createdAt: Date;
}

export type NotificationModel = Model<NotificationDoc>;

const notificationSchema = new Schema<NotificationDoc, NotificationModel>(
  {
    recipientType: { type: String, enum: ['user', 'admin'], required: true },
    recipientId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['comment', 'reply', 'like', 'favorite', 'article'], required: true },
    actorType: { type: String, enum: ['user', 'admin'], required: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorName: { type: String, required: true, trim: true, maxlength: 32 },
    articleId: { type: Schema.Types.ObjectId, default: undefined },
    articleTitle: { type: String, default: undefined, maxlength: 200 },
    commentId: { type: Schema.Types.ObjectId, default: undefined },
    commentContent: { type: String, default: undefined, maxlength: 1000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// 按接收者拉取通知 + 未读计数走索引
notificationSchema.index({ recipientType: 1, recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, recipientId: 1, read: 1 });

export const Notification = model<NotificationDoc, NotificationModel>(
  'Notification',
  notificationSchema,
);
