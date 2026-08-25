import type { Metadata } from 'next';

import { articleApi } from '@/lib/api';
import BlogDetailView from '@/views/blog-detail';

interface BlogDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 文章详情页（RSC）：generateMetadata 在服务端拉取文章标题/摘要生成 SEO 标签。
 * 替代原客户端 useSeo——客户端改 document.title 爬虫看不到，服务端渲染才有效。
 * 视图仍由 client 组件渲染，正文数据走 useArticleDetailQuery。
 */
export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const article = await articleApi.detail(id);
    return { title: `${article.title} · JasonLuo`, description: article.excerpt };
  } catch {
    return { title: '博客 · JasonLuo' };
  }
}

export default function BlogDetailPage() {
  return <BlogDetailView />;
}
