import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/queryClient';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * 全局 TanStack Query Provider
 *
 * 负责缓存查询结果、统一管理加载/错误状态。
 * mutation 成功后通过 invalidateQueries 自动刷新相关数据，
 * 页面组件不再需要手写 useEffect + loading/error state。
 */
export default function QueryProvider({ children }: QueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
