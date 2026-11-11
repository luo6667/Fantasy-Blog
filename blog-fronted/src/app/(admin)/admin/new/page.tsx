import type { Metadata } from 'next';

import ArticleEditor from '@/views/admin/ArticleEditor';

export const metadata: Metadata = {
  title: '新建文章 · JasonLuo',
  robots: { index: false, follow: false },
};

export default function AdminNewArticlePage() {
  return <ArticleEditor />;
}
