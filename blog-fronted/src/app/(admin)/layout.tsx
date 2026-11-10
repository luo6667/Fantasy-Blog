import AdminShell from '@/views/admin/AdminShell';

/**
 * 后台路由组布局（URL 仍是 /admin/*）
 *
 * 后台有自己的侧栏 IA，不套主站的 Nav / Footer；
 * AdminShell 负责登录校验、侧栏折叠与移动端抽屉。
 */
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
