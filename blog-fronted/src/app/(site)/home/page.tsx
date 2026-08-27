import { getGitHubContributions } from '@/lib/github';
import HomeView from '@/views/home';

/**
 * 📘 app/(site)/home/page.tsx —— 首页（Server Component + 服务端取数示例）
 *
 * 这是「服务端取数」的示范页：
 * - page.tsx 是 Server Component，可以直接 async 取数（这里拉 GitHub 贡献日历数据）；
 * - 取到的数据通过 props 传给 client 视图组件（views/home）；
 * - 取数失败时传 null，视图内自动隐藏贡献区块（降级而不是报错）。
 * 对比：client 组件里直接 fetch 不走 Next 的服务端环境，所以要数据优先在 page 层取。
 */
export default async function HomePage() {
  const contributions = await getGitHubContributions();
  return <HomeView contributions={contributions} />;
}
