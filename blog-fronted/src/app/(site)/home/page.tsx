import { getGitHubContributions } from '@/lib/github';
import HomeView from '@/views/home';

/**
 * 首页（Server Component）
 *
 * 服务端获取 GitHub 贡献日历数据后传给 client 视图（HomeView），
 * 数据获取失败时传 null，视图内自动隐藏贡献区块。
 */
export default async function HomePage() {
  const contributions = await getGitHubContributions();
  return <HomeView contributions={contributions} />;
}
