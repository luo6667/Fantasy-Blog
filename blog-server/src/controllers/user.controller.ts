import type { RequestHandler } from 'express';

import { deleteUser, listUsersForAdmin } from '../services/user.service.js';
import { ok } from '../utils/response.js';

/**
 * 用户控制器
 *
 * GET    /api/users/manage   用户列表 + 统计（管理员）
 * DELETE /api/users/:id      删除用户及级联数据（管理员）
 */

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
