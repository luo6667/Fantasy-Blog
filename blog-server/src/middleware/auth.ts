import type { RequestHandler } from 'express';

import { verifyToken } from '../services/auth.service.js';
import { HttpError } from './error.js';

/**
 * 登录鉴权中间件
 *
 * 解析 `Authorization: Bearer <token>`，校验通过后把用户注入 req.user。
 * 普通用户与管理员均可通过（评论区等需要登录的接口使用）。
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
