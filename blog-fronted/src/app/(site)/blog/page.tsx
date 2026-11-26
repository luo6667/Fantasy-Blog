import type { Metadata } from 'next';

import { articleApi, tagApi } from '@/lib/api';
import type { ArticleListItem, PaginatedResult, TagItem } from '@/types/api';
import BlogView from '@/views/blog';

/**
 * 📘 app/(site)/blog/page.tsx —— 博客列表页（SSG 首屏 + 客户端接管）
 *
 * - 构建时拉取第一页文章与标签计数，经 props 预填给 client 视图，首屏直出；
 * - 列表数据在运行时读取，避免本地/CI 构建时后端不可用而把空列表写入静态产物；
 * - 搜索 / 标签筛选 / 无限滚动是动态交互，仍由客户端 React Query 走 API
 *   （initialArticles 仅在无筛选状态预填，避免搜索时闪现错误内容）；
 * - 后端不可用（构建期或运行时）优雅降级：initial 为 null，客户端正常加载。
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '博客 · Fantasy',
  description: 'Fantasy 的技术博客 - 前端与全栈开发文章',
};

export default async function BlogPage() {
  let initial: PaginatedResult<ArticleListItem> | null = null;
  let initialTags: TagItem[] | null = null;
  try {
    [initial, initialTags] = await Promise.all([
      articleApi.list({ page: 1, pageSize: 10 }),
      tagApi.list(),
    ]);
  } catch {
    // 后端不可用：降级为空壳，客户端正常加载
  }
  return <BlogView initialArticles={initial} initialTags={initialTags} />;
}
