import type { JwtPayload as BaseJwtPayload } from 'jsonwebtoken';

/** 身份角色 */
export type UserRole = 'user' | 'admin';

/** JWT 载荷（登录签发时写入） */
export interface JwtPayload extends BaseJwtPayload {
  /** 用户/管理员 _id */
  sub: string;
  username: string;
  /** 身份：user 普通用户 / admin 管理员 */
  role: UserRole;
}

/** 已登录用户（挂到 req.user） */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}
