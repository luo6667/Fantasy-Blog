import { create } from 'zustand';

import { authApi, tokenStore } from '@/lib/api';
import type { AuthUser } from '@/types/api';

/**
 * 📘 stores/authStore.ts —— 管理员登录态 Store（技术栈：zustand）
 *
 * 站点只保留管理员身份：
 * - 启动时（模块加载）校验本地 token（GET /api/auth/me），token 失效自动清除；
 * - login / logout 集中在此；
 * - 通过 useAuth() hook 读取，组件只订阅所需片段，避免整棵子树重渲染。
 */
interface AuthState {
  user: AuthUser | null;
  /** 启动时是否仍在校验本地 token */
  checking: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
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

  login: async (username, password) => {
    const result = await authApi.login(username, password);
    tokenStore.set(result.token);
    set({ user: result.user, checking: false });
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
