import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tagApi } from '@/lib/api';
import { articleKeys, tagKeys } from '@/lib/queryKeys';
import type { TagItem } from '@/types/api';

/**
 * 主标签库查询 / 变更 hooks
 *
 * 主标签库（/tags）在博客筛选栏、管理页、编辑器中复用同一份缓存。
 */

/** 主标签列表（含文章数）；initialData 用于 SSG 首屏预填 */
export function useTagsQuery(initialData?: TagItem[] | null) {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: tagApi.list,
    initialData: initialData ?? undefined,
  });
}

/** 创建主标签 */
export function useCreateTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => tagApi.create(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** 重命名主标签（文章列表里的标签名会同步变化） */
export function useRenameTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => tagApi.rename(id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['article'] });
    },
  });
}

/** 删除主标签（后端在被文章引用时会拒绝） */
export function useDeleteTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tagApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['article'] });
    },
  });
}
