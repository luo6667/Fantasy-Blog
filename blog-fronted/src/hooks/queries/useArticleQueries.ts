import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { articleApi } from '@/lib/api';
import { articleKeys, tagKeys } from '@/lib/queryKeys';
import type { ArticleDetail, ArticleInput, ArticleListItem, PaginatedResult } from '@/types/api';

/**
 * 📘 hooks/queries/useArticleQueries.ts —— 文章查询/变更 Hooks（技术栈：TanStack Query）
 *
 * 博客列表页、详情页、管理页、编辑器共用的数据层：
 * - 列表查询 key 统一，管理页与博客页共享 pageSize=50 的同一份缓存；
 * - 详情 key 统一，详情页与编辑器（编辑模式）共享缓存；
 * - SSG 预渲染：列表/详情的初始数据由 page.tsx 服务端取数后经 props 注入，
 *   用 placeholderData 预填——首屏直出、不发请求；
 * - 增删改走 useMutation，成功后 invalidateQueries 相关 key，页面自动刷新。
 */

/** 文章分页列表（支持主标签筛选与关键字搜索；切换时保留上一份数据避免闪烁） */
export function useArticleListQuery(tag: string | null = null, search = '') {
  return useQuery({
    queryKey: [...articleKeys.list(tag), 'search', search],
    queryFn: () => articleApi.list({ pageSize: 50, tag: tag ?? undefined, search: search || undefined }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 博客列表「加载更多」分页（每页 10 篇）
 *
 * 独立 queryKey（...'infinite' 后缀），与 50 篇的管理页列表缓存互不干扰；
 * 删除/更新文章后仍会被 ['articles'] 前缀失效统一刷新。
 * initialData 为 SSG 首屏第一页（仅无搜索/无筛选时由 page.tsx 传入）。
 */
export function useArticleListInfiniteQuery(
  tag: string | null = null,
  search = '',
  initialData?: PaginatedResult<ArticleListItem> | null,
) {
  return useInfiniteQuery({
    queryKey: [...articleKeys.list(tag), 'search', search, 'infinite'],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      articleApi.list({
        page: pageParam,
        pageSize: 10,
        tag: tag ?? undefined,
        search: search || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.list.length > 0 && allPages.length * 10 < last.total ? allPages.length + 1 : undefined,
    // placeholderData 而非 initialData：首屏直出不发请求，且不触发 data/isLoading 类型收窄
    placeholderData: initialData ? { pages: [initialData], pageParams: [1] } : undefined,
    // 首屏数据来自 SSG 页面（ISR 一小时），挂载后立即重取只会造成重复请求
    staleTime: 5 * 60_000,
  });
}

/** 文章详情（id 为空时禁用请求；initialData 为 SSG 预渲染的正文，命中后首屏直出） */
export function useArticleDetailQuery(id: string | undefined, initialData?: ArticleDetail | null) {
  return useQuery({
    queryKey: articleKeys.detail(id ?? ''),
    queryFn: () => articleApi.detail(id as string),
    enabled: Boolean(id),
    placeholderData: initialData ?? undefined,
    staleTime: 300_000,
  });
}

/** 创建文章 */
export function useCreateArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ArticleInput) => articleApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** 更新文章 */
export function useUpdateArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ArticleInput> }) =>
      articleApi.update(id, input),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: articleKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** 删除文章（列表、详情与主标签计数都会变化） */
export function useDeleteArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => articleApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['article'] });
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}
