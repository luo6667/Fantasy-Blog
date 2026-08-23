import { fn, Op } from 'sequelize';

import { HttpError } from '../middleware/error.js';
import Article from '../models/Article.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import type { UserManageItem } from '../types/user.js';

/**
 * 用户管理业务逻辑（管理员）
 *
 * listUsersForAdmin：全部普通用户 + 评论数统计
 * deleteUser：删除用户并级联清理其评论、通知（作为接收者或触发者）、
 *             以及旧数据中该作者的文章
 */

/** 用户列表（含统计，按注册时间倒序） */
export async function listUsersForAdmin(): Promise<UserManageItem[]> {
  const [users, commentRows] = await Promise.all([
    User.findAll({ order: [['createdAt', 'DESC']] }),
    // 评论数：authorType='user' 按 authorId 分组
    Comment.findAll({
      where: { authorType: 'user' },
      attributes: ['authorId', [fn('COUNT', '*'), 'count']],
      group: ['authorId'],
      raw: true,
    }) as unknown as Promise<{ authorId: string; count: number }[]>,
  ]);

  const commentMap = new Map(commentRows.map((c) => [String(c.authorId), Number(c.count)]));

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    createdAt: u.createdAt.toISOString(),
    commentCount: commentMap.get(u.id) ?? 0,
  }));
}

/** 删除用户（仅普通用户；管理员账号在 Admin 集合，不会命中）并级联清理其数据 */
export async function deleteUser(id: string): Promise<{ id: string }> {
  const user = await User.findByPk(id);
  if (!user) {
    throw new HttpError(404, '用户不存在');
  }

  await Promise.all([
    // 用户本身
    User.destroy({ where: { id } }),
    // 评论（作者本人）
    Comment.destroy({ where: { authorType: 'user', authorId: id } }),
    // 通知：作为接收者（发给 TA 的）或作为触发者（TA 触发的）一并清理
    Notification.destroy({
      where: {
        [Op.or]: [
          { recipientType: 'user', recipientId: id },
          { actorType: 'user', actorId: id },
        ],
      },
    }),
    // 旧数据兜底：该作者的文章（当前业务仅管理员发文，此处防御性清理）
    Article.destroy({ where: { authorType: 'user', authorId: id } }),
  ]);

  return { id };
}
