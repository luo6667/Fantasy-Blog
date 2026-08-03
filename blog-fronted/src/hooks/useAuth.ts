import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext';

/**
 * 登录态 Hook
 *
 * 返回全局登录态（user / isAdmin / login / register / logout 等）。
 * 必须在 <AuthProvider> 内部使用，否则抛出明确错误。
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used within an <AuthProvider>');
  }
  return ctx;
}
