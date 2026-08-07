import type { RequestHandler } from 'express';

import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js';
import { deleteUser, listUsersForAdmin } from '../services/user.service.js';
import type { UserBrief } from '../types/user.js';
import { ok } from '../utils/response.js';

/**
 * 用户控制器
 *
 * GET    /api/users?search=  搜索可聊天的对方（登录）
 * GET    /api/users/manage   用户列表 + 统计（管理员）
 * DELETE /api/users/:id      删除用户及级联数据（管理员）
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const searchUsersHandler: RequestHandler = async (req, res) => {
  const me = req.user!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  // 空搜索返回全部用户（排除自己），便于「新会话」直接选择
  const rx = search !== '' ? new RegExp(escapeRegex(search), 'i') : null;

  const [admins, users] = await Promise.all([
    Admin.find(rx ? { username: rx } : {})
      .select('username')
      .limit(50)
      .lean(),
    User.find(rx ? { username: rx } : {})
      .select('username')
      .limit(200)
      .lean(),
  ]);

  const list: UserBrief[] = [
    ...admins.map((d) => ({ id: d._id.toString(), username: d.username, role: 'admin' as const })),
    ...users.map((d) => ({ id: d._id.toString(), username: d.username, role: 'user' as const })),
  ].filter((u) => !(u.role === me.role && u.id === me.id));

  ok(res, list);
};

/** 用户列表 + 统计（requireAdmin 之后调用） */
export const listUsersHandler: RequestHandler = async (_req, res) => {
  const list = await listUsersForAdmin();
  ok(res, list);
};

/** 删除用户及级联数据（requireAdmin 之后调用） */
export const deleteUserHandler: RequestHandler = async (req, res) => {
  const id = req.params.id as string;
  const result = await deleteUser(id);
  ok(res, result, '用户已删除');
};
