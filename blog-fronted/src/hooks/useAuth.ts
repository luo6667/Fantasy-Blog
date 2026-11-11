import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/stores/authStore';

/**
 * 管理员登录态 Hook
 *
 * 从 zustand authStore 读取，返回导航栏、管理后台与前台管理按钮所需的字段。
 * useShallow 做浅比较，只有字段实际变化时组件才重渲染。
 */
export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      user: s.user,
      checking: s.checking,
      isAdmin: s.user?.role === 'admin',
      login: s.login,
      logout: s.logout,
      refresh: s.refresh,
    })),
  );
}
