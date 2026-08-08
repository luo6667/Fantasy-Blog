import { Router } from 'express';
import { z } from 'zod';

import {
  loginHandler,
  meHandler,
  registerHandler,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

/** 注册请求体（仅普通用户） */
const registerSchema = z.object({
  username: z.string().trim().min(2, '用户名至少 2 个字符').max(32, '用户名最多 32 个字符'),
  password: z.string().min(8, '密码至少 8 个字符').max(72, '密码最多 72 个字符'),
});

/** 登录请求体（role 决定普通用户或管理员登录） */
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(32, '用户名最多 32 个字符'),
  // bcrypt 有效输入上限 72 字节，超长密码会浪费计算资源，显式限制
  password: z.string().min(1, '密码不能为空').max(72, '密码最多 72 个字符'),
  role: z.enum(['user', 'admin']).default('user'),
});

/**
 * 认证路由
 *
 * POST /api/auth/register 注册普通用户（公开，限流防刷）
 * POST /api/auth/login    登录（body.role: user | admin）→ { token, user }（限流防爆破）
 * GET  /api/auth/me       当前用户（需登录）
 */
router.post('/register', authLimiter, validateBody(registerSchema), registerHandler);
router.post('/login', authLimiter, validateBody(loginSchema), loginHandler);
router.get('/me', requireAuth, meHandler);

export default router;
