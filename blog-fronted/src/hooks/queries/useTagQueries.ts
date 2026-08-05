import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tagApi } from '@/lib/api';
import { articleKeys, tagKeys } from '@/lib/queryKeys';

/**
 * 标签库查询 / 变更 hooks
 *
 * 标签库列表（/tags）在管理页、用户面板、编辑器中复用同一份缓存。
 */

/** 标签库列表（含文章数） */
export function useTagsQuery() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: tagApi.list,
  });
}

/** 创建标签（只影响标签库本身） */
export function useCreateTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => tagApi.create(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** 删除标签（会从所有文章移除，需同时刷新文章列表与标签计数） */
export function useDeleteTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => tagApi.remove(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: articleKeys.tags });
      void queryClient.invalidateQueries({ queryKey: ['article'] });
    },
  });
}
