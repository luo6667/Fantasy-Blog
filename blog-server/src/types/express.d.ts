import type { AuthUser } from './auth.js';

/**
 * Express Request 扩展
 *
 * requireAuth 中间件校验通过后注入 req.user，供受保护接口使用。
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
