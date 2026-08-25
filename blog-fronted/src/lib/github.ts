/**
 * GitHub 贡献数据获取（服务端）
 *
 * 数据源：github-contributions-api.jogruber.de（免费公共 API，无需 token，每日更新）。
 * 需要更权威的数据时可替换为 GitHub GraphQL（contributionsCollection，需配置
 * GITHUB_TOKEN 环境变量），本模块是唯一的数据入口，替换成本低。
 * 仅在 Server Component 中调用，配合 `next: { revalidate }` 做 ISR 缓存。
 */

export interface GitHubContributionDay {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 当日贡献数 */
  count: number;
  /** 0-4 热力等级（0 = 无贡献） */
  level: number;
}

export interface GitHubContributionsData {
  /** 过去一年总贡献数 */
  total: number;
  /** 过去一年逐日数据（升序） */
  days: GitHubContributionDay[];
}

/** GitHub 用户名（与封面 / 导航的 GitHub 链接一致） */
export const GITHUB_USERNAME = 'luo6667';

const API_URL = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`;

/** 获取最近一年贡献日历；失败或数据异常返回 null（调用方降级隐藏） */
export async function getGitHubContributions(): Promise<GitHubContributionsData | null> {
  try {
    const res = await fetch(API_URL, {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'jasonluo-blog' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      total?: { lastYear?: number };
      contributions?: GitHubContributionDay[];
    };
    if (!json.contributions || json.contributions.length === 0) return null;
    return {
      total: json.total?.lastYear ?? 0,
      days: json.contributions,
    };
  } catch {
    return null;
  }
}
