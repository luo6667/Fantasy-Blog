import { createContext } from 'react';

import type { AuthUser, UserRole } from '@/types/api';

export type { AuthUser, UserRole } from '@/types/api';

/** 全局登录态上下文值 */
export interface AuthContextValue {
  /** 当前登录用户（普通用户或管理员）；未登录为 null */
  user: AuthUser | null;
  /** 启动时是否正在校验本地 token */
  checking: boolean;
  /** 是否为管理员 */
  isAdmin: boolean;
  /** 登录（role: user 普通用户 / admin 管理员），成功写入 token 并更新状态 */
  login: (role: UserRole, username: string, password: string) => Promise<void>;
  /** 注册普通用户并自动登录 */
  register: (username: string, password: string) => Promise<void>;
  /** 退出登录 */
  logout: () => void;
  /** 重新校验登录态（登录/退出后刷新） */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
