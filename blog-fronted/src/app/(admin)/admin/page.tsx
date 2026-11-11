import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '后台管理 · JasonLuo',
  robots: { index: false, follow: false },
};

/** /admin 默认进入文章管理页 */
export default function AdminIndexPage() {
  redirect('/admin/articles');
}
