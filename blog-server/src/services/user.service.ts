import type { Types } from 'mongoose';

import { HttpError } from '../middleware/error.js';
import { Article } from '../models/Article.js';
import { Comment } from '../models/Comment.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import type { UserManageItem } from '../types/user.js';

/**
 * 用户管理业务逻辑（管理员）
 *
 * listUsersForAdmin：全部普通用户 + 评论数 / 收藏文章数统计
 * deleteUser：删除用户并级联清理其评论、通知（作为接收者或触发者）、
 *             私信会话与消息、以及旧数据中该作者的文章
 */

/** 用户列表（含统计，按注册时间倒序） */
export async function listUsersForAdmin(): Promise<UserManageItem[]> {
  const [users, commentCounts, favoriteCounts] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean(),
    // 评论数：authorType='user' 按 authorId 分组
    Comment.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { authorType: 'user' } },
      { $group: { _id: '$authorId', count: { $sum: 1 } } },
    ]),
    // 收藏文章数：文章的 favoritedBy 数组中 "user:<id>" 出现的文章数
    Article.aggregate<{ _id: string; count: number }>([
      { $unwind: '$favoritedBy' },
      { $match: { favoritedBy: { $regex: '^user:' } } },
      { $group: { _id: '$favoritedBy', count: { $sum: 1 } } },
    ]),
  ]);

  const commentMap = new Map(commentCounts.map((c) => [c._id.toString(), c.count]));
  const favoriteMap = new Map(
    favoriteCounts.map((f) => [f._id.slice('user:'.length), f.count]),
  );

  return users.map((u) => ({
    id: u._id.toString(),
    username: u.username,
    createdAt: u.createdAt.toISOString(),
    commentCount: commentMap.get(u._id.toString()) ?? 0,
    favoriteCount: favoriteMap.get(u._id.toString()) ?? 0,
  }));
}

/** 删除用户（仅普通用户；管理员账号在 Admin 集合，不会命中）并级联清理其数据 */
export async function deleteUser(id: string): Promise<{ id: string }> {
  const user = await User.findById(id);
  if (!user) {
    throw new HttpError(404, '用户不存在');
  }

  // 该用户参与的私信会话（participants 存 "user:<id>"）
  const convIds = (
    await Conversation.find({ participants: `user:${id}` }).select('_id').lean()
  ).map((c) => c._id);

  await Promise.all([
    // 用户本身
    User.deleteOne({ _id: id }),
    // 评论（作者本人）
    Comment.deleteMany({ authorType: 'user', authorId: id }),
    // 通知：作为接收者（发给 TA 的）或作为触发者（TA 触发的）一并清理
    Notification.deleteMany({
      $or: [
        { recipientType: 'user', recipientId: id },
        { actorType: 'user', actorId: id },
      ],
    }),
    // 私信：该用户参与的会话及其全部消息
    Message.deleteMany({ conversation: { $in: convIds } }),
    Conversation.deleteMany({ _id: { $in: convIds } }),
    // 旧数据兜底：该作者的文章（当前业务仅管理员发文，此处防御性清理）
    Article.deleteMany({ authorType: 'user', authorId: id }),
  ]);

  return { id };
}
