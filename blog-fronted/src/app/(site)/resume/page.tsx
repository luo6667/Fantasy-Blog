import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { Metadata } from 'next';

import { siteContentApi } from '@/lib/api';
import { siteContentKeys } from '@/lib/queryKeys';
import { SITE_CONTENT_FALLBACKS } from '@/lib/siteContentFallbacks';
import Resume from '@/views/resume';

/** 简历页 SEO（服务端渲染，替代原 useSeo） */
export const metadata: Metadata = {
  title: '简历 · Fantasy',
  description: '专业技能、项目经历与个人评价',
};

/**
 * /resume 页面（服务端组件 + react-query SSR 预取 + ISR）：
 * - 简历站点内容均为公开接口，服务端 prefetch 后经 HydrationBoundary 注入，
 *   客户端 Resume 组件（useSiteContentQuery 同 queryKey）直接命中缓存，首屏无 loading；
 * - export const revalidate = 3600：内容改动不频繁，页面静态化、每小时按需重新生成；
 * - 后台改完简历内容后，后端调用 /api/revalidate 立即重建本页（on-demand），
 *   见 blog-server/src/utils/revalidate.ts；
 * - 后端未启动 / 查询失败时吞掉错误，客户端 Resume 的 useQuery 会自行加载并回退默认常量。
 */
export const revalidate = 3600;

export default async function ResumePage() {
  const qc = new QueryClient();
  const keys = ['education', 'skills', 'internships', 'resumeProjects', 'evaluation'] as const;
  await Promise.all(
    keys.map((key) =>
      qc.query({
        queryKey: siteContentKeys.byKey(key),
        queryFn: () => siteContentApi.get(key),
      }).catch(() => {
        // 后端未启动 / 查询失败：写入默认值，保证服务端 HTML 与客户端首屏一致
        qc.setQueryData(siteContentKeys.byKey(key), SITE_CONTENT_FALLBACKS[key]);
      }),
    ),
  );

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Resume />
    </HydrationBoundary>
  );
}
