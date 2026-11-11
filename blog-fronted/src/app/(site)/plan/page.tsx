import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { Metadata } from 'next';

import { siteContentApi } from '@/lib/api';
import { siteContentKeys } from '@/lib/queryKeys';
import { SITE_CONTENT_FALLBACKS } from '@/lib/siteContentFallbacks';
import Plan from '@/views/plan';

/** 规划页 SEO（服务端渲染） */
export const metadata: Metadata = {
  title: '规划 · Fantasy',
  description: '个人成长与学习路线图：阶段目标、当前进展与长期方向',
};

export const revalidate = 3600;

/**
 * /plan 页面（服务端组件 + react-query SSR 预取 + ISR）：
 * - 规划内容来自公开接口 /api/site-content/plan，服务端 prefetch 后经 HydrationBoundary 注入，
 *   客户端 Plan 组件（useSiteContentQuery 同 queryKey）直接命中缓存，首屏无 loading；
 * - export const revalidate = 3600：内容改动不频繁，页面静态化、每小时重新生成；
 * - 后台改完规划内容后，后端调用 /api/revalidate 立即重建本页（on-demand）；
 * - 后端未启动 / 查询失败时吞掉错误，客户端 useQuery 会自行加载并回退默认常量。
 */
export default async function PlanPage() {
  const qc = new QueryClient();
  await qc
    .query({
      queryKey: siteContentKeys.byKey('plan'),
      queryFn: () => siteContentApi.get('plan'),
    })
    .catch(() => {
      // 后端未启动 / 查询失败：写入默认值，避免服务端与客户端首屏不一致
      qc.setQueryData(siteContentKeys.byKey('plan'), SITE_CONTENT_FALLBACKS.plan);
    });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Plan />
    </HydrationBoundary>
  );
}
