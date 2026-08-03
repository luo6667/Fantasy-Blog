import type { RequestHandler } from 'express';

import { loginAdmin, loginUser, register } from '../services/auth.service.js';
import type { UserRole } from '../types/auth.js';
import { ok } from '../utils/response.js';

/**
 * 认证控制器
 *
 * body 已由 validateBody 中间件完成 zod 校验并写回 req.body。
 */

/** 注册普通用户（仅普通用户可注册） */
export const registerHandler: RequestHandler = async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  const user = await register(username, password);
  ok(res, user, '注册成功', 201);
};

/** 登录：按 role 走普通用户或管理员登录 */
export const loginHandler: RequestHandler = async (req, res) => {
  const { username, password, role } = req.body as {
    username: string;
    password: string;
    role: UserRole;
  };
  const result = role === 'admin' ? await loginAdmin(username, password) : await loginUser(username, password);
  ok(res, result, '登录成功');
};

/** 当前登录用户（requireAuth 之后调用） */
export const meHandler: RequestHandler = (req, res) => {
  ok(res, req.user);
};
