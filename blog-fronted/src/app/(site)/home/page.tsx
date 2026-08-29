import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';

import { siteContentApi } from '@/lib/api';
import { getGitHubContributions } from '@/lib/github';
import { siteContentKeys } from '@/lib/queryKeys';
import HomeView from '@/views/home';

/**
 * 📘 app/(site)/home/page.tsx —— 首页（Server Component + 服务端取数 + ISR）
 *
 * 这是「服务端取数」的示范页：
 * - GitHub 贡献：fetch 带 next.revalidate=3600，按小时缓存；
 * - homeProjects 站点内容：服务端 prefetch 后经 HydrationBoundary 注入，
 *   客户端 HomeView 的 useSiteContentQuery 同 key 命中缓存，首屏无 loading；
 * - export const revalidate = 3600：整页静态化，每小时按需重新生成；
 *   后台改完首页项目后，后端调用 /api/revalidate 立即重建本页（on-demand）；
 * - 取数失败时降级：贡献传 null（视图内自动隐藏贡献区块）、站点内容回退默认常量，
 *   而不是报错。
 */
export const revalidate = 3600;

export default async function HomePage() {
  const contributions = await getGitHubContributions();

  const qc = new QueryClient();
  await qc
    .query({
      queryKey: siteContentKeys.byKey('homeProjects'),
      queryFn: () => siteContentApi.get('homeProjects'),
    })
    .catch(() => {
      // 后端未启动 / 查询失败：吞掉错误，客户端 useSiteContentQuery 自行加载并回退默认常量
    });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <HomeView contributions={contributions} />
    </HydrationBoundary>
  );
}
