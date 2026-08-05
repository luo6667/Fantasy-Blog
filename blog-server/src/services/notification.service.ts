import type { FilterQuery } from 'mongoose';

import { Admin } from '../models/Admin.js';
import type { ArticleDoc } from '../models/Article.js';
import { Notification, type NotificationDoc } from '../models/Notification.js';
import { getIO, userRoom } from '../socket.js';
import type { AuthUser } from '../types/auth.js';
import type { NotificationItem, NotificationType } from '../types/notification.js';

/**
 * 通知业务逻辑
 *
 * createNotification：评论文章 / 回复评论 / 点赞 / 收藏 / 新文章发布时调用；
 * 接收者在线时通过 Socket.IO 实时推送 notification:new。
 */

/**
 * 解析文章的通知接收者：优先取文章作者；旧数据无作者时回退通知管理员
 * （历史文章均由管理员发布）。返回 null 表示无接收者。
 */
export async function resolveArticleRecipient(
  article: ArticleDoc,
): Promise<{ role: 'user' | 'admin'; id: string } | null> {
  if (article.authorId && article.authorType) {
    return { role: article.authorType, id: article.authorId.toString() };
  }
  const admin = await Admin.findOne().select('_id').lean();
  return admin ? { role: 'admin', id: admin._id.toString() } : null;
}

/** 创建通知入参 */
export interface CreateNotificationInput {
  recipient: { role: 'user' | 'admin'; id: string };
  actor: AuthUser;
  type: NotificationType;
  articleId?: string;
  articleTitle?: string;
  commentId?: string;
  commentContent?: string;
}

function toItem(doc: NotificationDoc): NotificationItem {
  return {
    id: doc._id.toString(),
    type: doc.type,
    actorName: doc.actorName,
    actorType: doc.actorType,
    articleId: doc.articleId?.toString(),
    articleTitle: doc.articleTitle,
    commentContent: doc.commentContent,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** 创建通知并实时推送 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationItem> {
  const doc = await Notification.create({
    recipientType: input.recipient.role,
    recipientId: input.recipient.id,
    type: input.type,
    actorType: input.actor.role,
    actorId: input.actor.id,
    actorName: input.actor.username,
    articleId: input.articleId,
    articleTitle: input.articleTitle,
    commentId: input.commentId,
    commentContent: input.commentContent,
  });
  const item = toItem(doc);
  getIO()?.to(userRoom(input.recipient)).emit('notification:new', item);
  return item;
}

/** 当前用户的通知列表（倒序，最多 50 条） */
export async function listNotifications(user: AuthUser): Promise<NotificationItem[]> {
  const docs = await Notification.find({ recipientType: user.role, recipientId: user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return docs.map(toItem);
}

/** 未读通知数 */
export async function unreadNotificationCount(user: AuthUser): Promise<{ count: number }> {
  const count = await Notification.countDocuments({
    recipientType: user.role,
    recipientId: user.id,
    read: false,
  });
  return { count };
}

/** 标记已读（传 ids 则只标记指定通知，否则全部） */
export async function markNotificationsRead(
  user: AuthUser,
  ids?: string[],
): Promise<{ ok: boolean }> {
  const filter: FilterQuery<NotificationDoc> = { recipientType: user.role, recipientId: user.id };
  if (ids && ids.length > 0) {
    filter._id = { $in: ids };
  }
  await Notification.updateMany(filter, { $set: { read: true } });
  return { ok: true };
}
