import type { RequestHandler } from 'express';
import { Op } from 'sequelize';

import Admin from '../models/Admin.js';
import User from '../models/User.js';
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

/** 转义 LIKE 通配符（MySQL LIKE 默认大小写不敏感，等价原正则 'i' 匹配） */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export const searchUsersHandler: RequestHandler = async (req, res) => {
  const me = req.user!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  // 空搜索：列出全部普通用户（不含管理员账号），便于「新会话」直接选择
  // 管理员不列出，避免用户名枚举暴露 admin 账号；搜索管理员时需输入关键词
  if (search === '') {
    const users = await User.findAll({ attributes: ['id', 'username'], limit: 200 });
    const list: UserBrief[] = users
      .map((u) => ({ id: u.id, username: u.username, role: 'user' as const }))
      .filter((u) => !(u.role === me.role && u.id === me.id));
    ok(res, list);
    return;
  }

  const kw = escapeLike(search);

  const [admins, users] = await Promise.all([
    Admin.findAll({
      where: { username: { [Op.like]: `%${kw}%` } },
      attributes: ['id', 'username'],
      limit: 50,
    }),
    User.findAll({
      where: { username: { [Op.like]: `%${kw}%` } },
      attributes: ['id', 'username'],
      limit: 200,
    }),
  ]);

  const list: UserBrief[] = [
    ...admins.map((d) => ({ id: d.id, username: d.username, role: 'admin' as const })),
    ...users.map((d) => ({ id: d.id, username: d.username, role: 'user' as const })),
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
