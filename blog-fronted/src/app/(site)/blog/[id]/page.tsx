import type { Metadata } from 'next';

import { articleApi } from '@/lib/api';
import type { ArticleDetail } from '@/types/api';
import BlogDetailView from '@/views/blog-detail';

interface BlogDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 📘 app/(site)/blog/[id]/page.tsx —— 文章详情页（SSG + ISR + on-demand revalidate）
 *
 * 这是 Next.js 核心能力（SSG）的示范页：
 * - generateStaticParams：构建时枚举所有文章 id，正文在构建期渲染成静态 HTML，
 *   爬虫与首屏直接拿到全文（此前正文走客户端 fetch，HTML 里只有骨架，SEO 差）；
 * - export const revalidate = 3600：ISR 兜底，静态页每小时按需重新生成；
 * - generateMetadata 随构建执行一次，不再每次请求打后端；
 * - 发文章 / 改文章 / 删文章后，后端会调用 /api/revalidate 立即重建本页
 *   （on-demand revalidation，见 blog-server/src/utils/revalidate.ts），
 *   不用等 ISR 周期，也不用重新部署；
 * - 正文经 initialArticle props 传给 client 视图首屏直出；
 *   评论区 / 点赞 / AI 助手 / 登录态仍由客户端 React Query 接管——它们是动态数据，
 *   不在静态 HTML 里，发表后由 invalidateQueries 即时刷新，不走 revalidate；
 * - 后端不可用（构建期或运行时）优雅降级：initialArticle 为 null，
 *   客户端 useArticleDetailQuery 自行加载，构建不会因此失败。
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const { list } = await articleApi.list({ pageSize: 1000 });
    return list.map((a) => ({ id: a.id }));
  } catch {
    // 后端不可用时不预生成；dynamicParams 默认 true，运行时按需生成兜底
    return [];
  }
}

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const article = await articleApi.detail(id);
    return { title: `${article.title} · JasonLuo`, description: article.excerpt };
  } catch {
    return { title: '博客 · JasonLuo' };
  }
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  let initialArticle: ArticleDetail | null = null;
  try {
    initialArticle = await articleApi.detail(id);
  } catch {
    // 后端临时不可用：渲染空壳，客户端 useArticleDetailQuery 自行加载正文
  }
  return <BlogDetailView initialArticle={initialArticle} />;
}
