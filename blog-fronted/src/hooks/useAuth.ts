import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/stores/authStore';

/**
 * 登录态 Hook
 *
 * 从 zustand authStore 读取，返回与旧 AuthContext 相同形状的对象，
 * 供导航栏、博客页、评论区、管理页等使用。
 * useShallow 做浅比较，只有字段实际变化时组件才重渲染。
 */
export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      user: s.user,
      checking: s.checking,
      isAdmin: s.user?.role === 'admin',
      login: s.login,
      register: s.register,
      logout: s.logout,
      refresh: s.refresh,
    })),
  );
}
