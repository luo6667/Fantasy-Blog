import { Op } from 'sequelize';

import Admin from '../models/Admin.js';
import type Article from '../models/Article.js';
import Notification from '../models/Notification.js';
import type { AuthUser } from '../types/auth.js';
import type { NotificationItem, NotificationType } from '../types/notification.js';

/**
 * 通知业务逻辑
 *
 * createNotification：评论文章 / 回复评论 / 点赞 / 新文章发布时调用，落库后由前端拉取。
 * （已移除实时推送：SSE 随私信功能一并下线，通知改为 REST 查询）
 */

/**
 * 解析文章的通知接收者：优先取文章作者；旧数据无作者时回退通知管理员
 * （历史文章均由管理员发布）。返回 null 表示无接收者。
 */
export async function resolveArticleRecipient(
  article: Article,
): Promise<{ role: 'user' | 'admin'; id: string } | null> {
  if (article.authorId && article.authorType) {
    return { role: article.authorType, id: article.authorId };
  }
  const admin = await Admin.findOne({ attributes: ['id'] });
  return admin ? { role: 'admin', id: admin.id } : null;
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

function toItem(doc: Notification): NotificationItem {
  return {
    id: doc.id,
    type: doc.type,
    actorName: doc.actorName,
    actorType: doc.actorType,
    articleId: doc.articleId ?? undefined,
    articleTitle: doc.articleTitle ?? undefined,
    commentContent: doc.commentContent ?? undefined,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** 创建通知并落库（前端拉取展示） */
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
    articleId: input.articleId ?? null,
    articleTitle: input.articleTitle ?? null,
    commentId: input.commentId ?? null,
    commentContent: input.commentContent ?? null,
  });
  return toItem(doc);
}

/** 当前用户的通知列表（倒序，最多 50 条） */
export async function listNotifications(user: AuthUser): Promise<NotificationItem[]> {
  const docs = await Notification.findAll({
    where: { recipientType: user.role, recipientId: user.id },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  return docs.map(toItem);
}

/** 未读通知数 */
export async function unreadNotificationCount(user: AuthUser): Promise<{ count: number }> {
  const count = await Notification.count({
    where: { recipientType: user.role, recipientId: user.id, read: false },
  });
  return { count };
}

/** 标记已读（传 ids 则只标记指定通知，否则全部） */
export async function markNotificationsRead(
  user: AuthUser,
  ids?: string[],
): Promise<{ ok: boolean }> {
  const where: { recipientType: 'user' | 'admin'; recipientId: string; id?: { [Op.in]: string[] } } = {
    recipientType: user.role,
    recipientId: user.id,
  };
  if (ids && ids.length > 0) {
    where.id = { [Op.in]: ids };
  }
  await Notification.update({ read: true }, { where });
  return { ok: true };
}
