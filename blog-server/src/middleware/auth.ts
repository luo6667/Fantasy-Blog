import type { RequestHandler } from 'express';

import { verifyToken } from '../services/auth.service.js';
import { HttpError } from './error.js';

/**
 * 📘 middleware/auth.ts —— 登录/管理员鉴权中间件（技术栈：JWT + Express 中间件）
 *
 * requireAuth：解析 `Authorization: Bearer <token>`，verifyToken 校验后把用户
 * 注入 req.user（评论区、点赞等"登录即可"的接口用）；
 * requireAdmin：在 requireAuth 之上再校验 role === 'admin'（文章增删改、标签、
 * 上传等管理接口用），非管理员返回 403。
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, '请先登录');
  }
  const token = header.slice('Bearer '.length);
  req.user = await verifyToken(token);
  next();
};

/**
 * 管理员鉴权中间件
 *
 * 在 requireAuth 之后使用（或直接调用），仅管理员可访问（文章增删改、标签管理、上传等）。
 */
export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, '请先登录');
  }
  const token = header.slice('Bearer '.length);
  const user = await verifyToken(token);
  if (user.role !== 'admin') {
    throw new HttpError(403, '需要管理员权限');
  }
  req.user = user;
  next();
};
