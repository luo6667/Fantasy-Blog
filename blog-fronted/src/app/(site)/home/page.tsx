import { articleApi, contributionApi, siteContentApi } from '@/lib/api';
import type { ContributionsData } from '@/lib/contributions';
import { SITE_CONTENT_FALLBACKS } from '@/lib/siteContentFallbacks';
import type { ArticleListItem } from '@/types/api';
import HomeView from '@/views/home';

/**
 * 📘 app/(site)/home/page.tsx —— 首页（Server Component + 服务端取数 + ISR）
 *
 * - GitHub 贡献与最近 3 篇文章在服务端取好，首屏直出、不发额外请求；
 * - homeProjects / plan 直接在服务端取好传给视图，不再注水缓存；
 * - 失败降级：贡献为 null（视图隐藏热力图）、文章为空数组、站点内容用默认常量，
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

  const [projectsValue, planValue] = await Promise.all([
    siteContentApi
      .get('homeProjects')
      .then((item) => item.value)
      .catch(() => SITE_CONTENT_FALLBACKS.homeProjects),
    siteContentApi
      .get('plan')
      .then((item) => item.value)
      .catch(() => SITE_CONTENT_FALLBACKS.plan),
  ]);

  return (
    <HomeView
      contributions={contributions}
      recentPosts={recentPosts}
      projectsValue={projectsValue}
      planValue={planValue}
    />
  );
}
