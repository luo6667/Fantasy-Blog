import { create } from 'zustand';

import { authApi, tokenStore } from '@/lib/api';
import type { AuthUser, UserRole } from '@/types/api';

/**
 * 登录态 Store（zustand）
 *
 * 替代原 AuthContext/AuthProvider：
 * - 启动时（模块加载）校验本地 token（GET /api/auth/me）
 * - login（普通用户/管理员）/ register / logout 集中在此
 * - 通过 useAuth() hook 读取，组件订阅所需片段，避免整棵子树重渲染
 */
interface AuthState {
  user: AuthUser | null;
  /** 启动时是否仍在校验本地 token */
  checking: boolean;
  login: (role: UserRole, username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  checking: true,

  refresh: async () => {
    if (!tokenStore.get()) {
      set({ user: null, checking: false });
      return;
    }
    try {
      const me = await authApi.me();
      set({ user: me, checking: false });
    } catch {
      tokenStore.clear();
      set({ user: null, checking: false });
    }
  },

  login: async (role, username, password) => {
    const result = await authApi.login(role, username, password);
    tokenStore.set(result.token);
    set({ user: result.user });
  },

  register: async (username, password) => {
    await authApi.register(username, password);
    await get().login('user', username, password);
  },

  logout: () => {
    tokenStore.clear();
    set({ user: null });
  },
}));

// 应用启动时校验本地 token（仅浏览器环境；模块级单例，幂等可重复执行）
if (typeof window !== 'undefined') {
  void useAuthStore.getState().refresh();
}
