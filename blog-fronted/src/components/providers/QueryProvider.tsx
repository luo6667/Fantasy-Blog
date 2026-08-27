'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/queryClient';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * 📘 providers/QueryProvider.tsx —— 全局 TanStack Query Provider（Client Component）
 *
 * 挂在根布局最外层，给整棵树提供 React Query 上下文——所有 useQuery / useMutation
 * 都依赖它。作用：
 * - 缓存查询结果、统一管理加载/错误状态；
 * - mutation 成功后通过 invalidateQueries 自动刷新相关数据，
 *   页面组件不用手写 useEffect + loading/error state。
 */
export default function QueryProvider({ children }: QueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
