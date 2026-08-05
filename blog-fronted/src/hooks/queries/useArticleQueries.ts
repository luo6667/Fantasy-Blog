import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { articleApi } from '@/lib/api';
import { articleKeys, tagKeys } from '@/lib/queryKeys';
import type { ArticleInput } from '@/types/api';

/**
 * 文章查询 / 变更 hooks
 *
 * 博客列表页、详情页、管理页、编辑器共用：
 * - 列表查询 key 统一，管理页与博客页共享 pageSize=50 的同一份缓存
 * - 详情 key 统一，详情页与编辑器（编辑模式）共享缓存
 * - 增删改成功后失效相关查询，页面自动刷新，无需手动 refetch
 */

/** 文章分页列表（支持标签筛选与关键字搜索；切换时保留上一份数据避免闪烁） */
export function useArticleListQuery(tag: string | null = null, search = '') {
  return useQuery({
    queryKey: [...articleKeys.list(tag), 'search', search],
    queryFn: () => articleApi.list({ pageSize: 50, tag: tag ?? undefined, search: search || undefined }),
    placeholderData: keepPreviousData,
  });
}

/** 标签计数（博客页筛选栏） */
export function useArticleTagsQuery() {
  return useQuery({
    queryKey: articleKeys.tags,
    queryFn: articleApi.tags,
  });
}

/** 文章详情（id 为空时禁用请求） */
export function useArticleDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: articleKeys.detail(id ?? ''),
    queryFn: () => articleApi.detail(id as string),
    enabled: Boolean(id),
  });
}

/** 创建文章 */
export function useCreateArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ArticleInput) => articleApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: articleKeys.tags });
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
      void queryClient.invalidateQueries({ queryKey: articleKeys.tags });
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** 删除文章（列表、详情与标签计数都会变化） */
export function useDeleteArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => articleApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['article'] });
      void queryClient.invalidateQueries({ queryKey: articleKeys.tags });
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}
