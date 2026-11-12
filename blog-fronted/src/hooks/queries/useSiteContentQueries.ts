import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { siteContentApi } from '@/lib/api';
import { siteContentKeys } from '@/lib/queryKeys';
import type { SiteContentKey, SiteContentValue } from '@/types/api';

/**
 * 站点内容查询 / 变更 hooks
 *
 * 简历页 / 首页按 key 读取（useSiteContentQuery，公开接口）；
 * 管理后台一次读取全部（useSiteContentsQuery），保存时按 key 整体 PUT。
 */

/** 单个内容（页面渲染用） */
export function useSiteContentQuery(key: SiteContentKey) {
  return useQuery({
    queryKey: siteContentKeys.byKey(key),
    queryFn: () => siteContentApi.get(key),
    // 页面已由服务端预取内容；首次水合沿用同一快照，后台保存后再由 mutation 失效缓存。
    staleTime: Infinity,
  });
}

/** 全部内容（管理后台用） */
export function useSiteContentsQuery() {
  return useQuery({
    queryKey: siteContentKeys.all,
    queryFn: siteContentApi.list,
  });
}

/** 更新单个内容（管理员） */
export function useUpdateSiteContentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: SiteContentKey; value: SiteContentValue }) =>
      siteContentApi.update(key, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteContentKeys.all });
    },
  });
}
