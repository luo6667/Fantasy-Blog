import { QueryClient } from '@tanstack/react-query';

/**
 * 📘 lib/queryClient.ts —— 全局 QueryClient 配置（技术栈：TanStack Query）
 *
 * 全站唯一的缓存实例，默认配置的含义：
 * - staleTime 30s：博客/评论数据变更不频繁，30s 内直接复用缓存，避免重复请求；
 * - refetchOnWindowFocus: false：切回窗口时不无意义刷新；
 * - retry 1：网络抖动重试一次，失败即展示错误（mutation 不重试）。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
