import type { Metadata } from 'next';

import AdminArticles from '@/views/admin/AdminArticles';

export const metadata: Metadata = {
  title: '文章管理 · JasonLuo',
  robots: { index: false, follow: false },
};

export default function AdminArticlesPage() {
  return <AdminArticles />;
}
