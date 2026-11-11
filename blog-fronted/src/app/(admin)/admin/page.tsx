import { redirect } from 'next/navigation';

/** /admin 默认进入文章管理页 */
export default function AdminIndexPage() {
  redirect('/admin/articles');
}
