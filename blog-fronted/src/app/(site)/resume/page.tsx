import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';

import { siteContentApi } from '@/lib/api';
import { siteContentKeys } from '@/lib/queryKeys';
import Resume from '@/views/resume';

/**
 * /resume 页面（服务端组件 + react-query SSR 预取）：
 * 4 个站点内容均为公开接口，服务端 prefetch 后经 HydrationBoundary 注入，
 * 客户端 Resume 组件（useSiteContentQuery 同 queryKey）直接命中缓存，首屏无 loading。
 */
export default async function ResumePage() {
  const qc = new QueryClient();
  const keys = ['education', 'skills', 'resumeProjects', 'evaluation'] as const;
  await Promise.all(
    keys.map((key) =>
      qc.query({
        queryKey: siteContentKeys.byKey(key),
        queryFn: () => siteContentApi.get(key),
      }).catch(() => {
        // 后端未启动 / 查询失败：吞掉错误，客户端 Resume 的 useQuery 会自行加载并回退默认常量
      }),
    ),
  );

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Resume />
    </HydrationBoundary>
  );
}
