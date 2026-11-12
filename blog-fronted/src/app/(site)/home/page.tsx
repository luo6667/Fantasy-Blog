import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';

import { articleApi, contributionApi, siteContentApi } from '@/lib/api';
import type { ContributionsData } from '@/lib/contributions';
import { siteContentKeys } from '@/lib/queryKeys';
import { SITE_CONTENT_FALLBACKS } from '@/lib/siteContentFallbacks';
import type { ArticleListItem, SiteContentItem } from '@/types/api';
import HomeView from '@/views/home';

/**
 * 📘 app/(site)/home/page.tsx —— 首页（Server Component + 服务端取数 + ISR）
 *
 * - GitHub 贡献与最近 3 篇文章在服务端取好，首屏直出、不发额外请求；
 * - homeProjects / plan 走站点内容接口，prefetch 后经 HydrationBoundary 注入，
 *   客户端 useSiteContentQuery 同 key 命中缓存；
 * - 失败降级：贡献为 null（视图隐藏热力图）、文章为空数组、站点内容写默认常量，
 *   避免服务端与客户端首屏不一致；
 * - export const revalidate = 3600：整页静态化，后台保存后由后端按 key 触发重建。
 */
export const revalidate = 3600;

export default async function HomePage() {
  const contributions = await contributionApi.get().catch(() => null as ContributionsData | null);

  const recentPosts = await articleApi
    .list({ page: 1, pageSize: 3 })
    .then((res) => res.list)
    .catch(() => [] as ArticleListItem[]);

  const qc = new QueryClient();

  await Promise.all(
    (['homeProjects', 'plan'] as const).map((key) =>
      qc
        .query({
          queryKey: siteContentKeys.byKey(key),
          queryFn: () => siteContentApi.get(key),
        })
        .catch(() => {
          qc.setQueryData(siteContentKeys.byKey(key), SITE_CONTENT_FALLBACKS[key]);
        }),
    ),
  );

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <HomeView
        contributions={contributions}
        recentPosts={recentPosts}
        projectsValue={(qc.getQueryData<SiteContentItem>(siteContentKeys.byKey('homeProjects'))?.value ?? SITE_CONTENT_FALLBACKS.homeProjects)}
        planValue={(qc.getQueryData<SiteContentItem>(siteContentKeys.byKey('plan'))?.value ?? SITE_CONTENT_FALLBACKS.plan)}
      />
    </HydrationBoundary>
  );
}
