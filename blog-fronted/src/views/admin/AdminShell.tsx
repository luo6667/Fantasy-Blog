'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';

const ADMIN_NAV = [
  { href: '/admin/articles', label: '文章管理', desc: '文章 · 主标签' },
  { href: '/admin/plan', label: '规划管理', desc: '成长路线图' },
  { href: '/admin/resume', label: '简历管理', desc: '教育 · 技能 · 项目' },
] as const;

/**
 * 后台外壳（/admin/* 共享布局）
 *
 * - /admin/login 不套侧栏；
 * - 未登录访问其它后台页 → 重定向到 /admin/login；
 * - 桌面端固定左侧可收起侧栏，移动端顶部抽屉；
 * - 底部固定「退出登录」并回到首页。
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, checking, user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    if (!isLogin && !checking && !isAdmin) router.replace('/admin/login');
  }, [isLogin, checking, isAdmin, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (isLogin) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] text-text-muted">
        校验登录状态…
      </div>
    );
  }

  if (!isAdmin) return null;

  function handleLogout() {
    logout();
    router.push('/home');
  }

  const navList = (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-accent-soft font-semibold text-accent'
                : 'text-text-secondary hover:bg-bg-alt hover:text-[var(--color-text)]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-[var(--color-border)] group-hover:bg-accent/60'}`}
            />
            {!collapsed && (
              <span className="flex min-w-0 flex-col">
                <span>{item.label}</span>
                <span className="text-[0.6875rem] font-normal text-text-muted">{item.desc}</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-[var(--color-border-light)] px-3 pt-3">
      {!collapsed && (
        <p className="mb-2 truncate text-xs text-text-muted" title={user?.username}>
          {user?.username} · 管理员
        </p>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="w-full cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-red-400 hover:text-red-500"
      >
        {collapsed ? '↪' : '退出登录'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* 桌面侧栏 */}
      <motion.aside
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--color-border-light)] bg-surface px-3 py-5 md:flex"
        animate={{ width: collapsed ? 64 : 232 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-1">
          {!collapsed && (
            <Link href="/home" className="truncate text-sm font-bold text-accent">
              Fantasy · 管理
            </Link>
          )}
          <button
            type="button"
            onClick={() => { setCollapsed((v) => !v); }}
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            className="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{navList}</div>
        {footer}
      </motion.aside>

      {/* 移动端顶栏 */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border-light)] bg-surface px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => { setDrawerOpen(true); }}
          aria-label="打开菜单"
          className="cursor-pointer text-lg text-text-secondary"
        >
          ☰
        </button>
        <span className="text-sm font-semibold">管理后台</span>
        <Link href="/home" className="ml-auto text-xs text-text-muted hover:text-accent">
          回首页
        </Link>
      </div>

      {/* 移动端抽屉 */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => { setDrawerOpen(false); }}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface px-3 py-5 shadow-xl"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <Link href="/home" className="text-sm font-bold text-accent">
                  Fantasy · 管理
                </Link>
                <button
                  type="button"
                  onClick={() => { setDrawerOpen(false); }}
                  className="text-text-muted"
                  aria-label="关闭菜单"
                >
                  ×
                </button>
              </div>
              <div className="flex-1">{navList}</div>
              {footer}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 内容区 */}
      <div
        className={`transition-[padding] duration-300 ${collapsed ? 'md:pl-16' : 'md:pl-[232px]'}`}
      >
        <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
      </div>
    </div>
  );
}
