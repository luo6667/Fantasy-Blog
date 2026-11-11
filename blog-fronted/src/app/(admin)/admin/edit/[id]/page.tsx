import type { Metadata } from 'next';

import ArticleEditor from '@/views/admin/ArticleEditor';

export const metadata: Metadata = {
  title: '编辑文章 · JasonLuo',
  robots: { index: false, follow: false },
};

export default function AdminEditArticlePage() {
  return <ArticleEditor />;
}
