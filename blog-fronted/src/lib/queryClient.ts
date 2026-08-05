import { QueryClient } from '@tanstack/react-query';

/**
 * 全局 QueryClient
 *
 * 默认配置说明：
 * - staleTime 30s：博客/评论数据变更不频繁，短时间内直接复用缓存，避免重复请求
 * - refetchOnWindowFocus: false：切回窗口时不无意义刷新
 * - retry 1：网络抖动时重试一次，失败即展示错误
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
