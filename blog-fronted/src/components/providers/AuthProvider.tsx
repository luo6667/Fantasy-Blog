import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { AuthContext } from '@/contexts/AuthContext';
import { authApi, tokenStore } from '@/lib/api';
import type { AuthUser, UserRole } from '@/types/api';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 登录态 Provider
 *
 * 启动时校验本地 token（GET /api/auth/me），
 * 提供 login（普通用户/管理员）/ register（普通用户）/ logout。
 * 登录态变化通过 context 驱动导航栏、博客页、评论区实时更新。
 */
export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setChecking(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 登录（role 决定普通用户或管理员） */
  const login = useCallback(
    async (role: UserRole, username: string, password: string) => {
      const result = await authApi.login(role, username, password);
      tokenStore.set(result.token);
      setUser(result.user);
    },
    [],
  );

  /** 注册普通用户并自动登录 */
  const register = useCallback(
    async (username: string, password: string) => {
      await authApi.register(username, password);
      await login('user', username, password);
    },
    [login],
  );

  /** 退出登录 */
  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, checking, isAdmin: user?.role === 'admin', login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
