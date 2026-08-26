import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { lazy, Suspense, useState } from 'react';

import { MotionLink, SafeImg } from '@/components/common';
import { NAV_TABS } from '@/constants';
import { useNotificationsUnreadQuery } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { springBtn } from '@/lib/motion';
import type { ThemeMode } from '@/types';

// 弹窗 / 面板按需懒加载，避免打进首屏包（Nav 是 Layout 常驻组件）
const AuthModal = lazy(() => import('@/components/auth/AuthModal'));
const NotificationPanel = lazy(() => import('@/components/notification/NotificationPanel'));

interface NavProps {
  theme: ThemeMode;
  onToggle: () => void;
}

const linkBase =
  'cursor-pointer border-none bg-transparent px-3 py-1.5 font-[inherit] text-sm font-medium text-text-secondary hover:text-[var(--color-text)]';

/**
 * 顶部导航栏组件
 *
 * - 品牌 Logo 右侧：管理员登录后显示「管理」入口
 * - 右侧：未登录显示「请登录」（打开登录/注册弹窗），已登录显示用户名与退出
 * - 主题切换按钮、桌面/移动端导航菜单
 */
export default function Nav({ theme, onToggle }: NavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user, isAdmin, checking, logout } = useAuth();

  // 通知未读数（REST 查询，登录后拉取）
  const { data: unreadData } = useNotificationsUnreadQuery(Boolean(user));
  const unreadNotifications = unreadData?.count ?? 0;

  /** 打开通知面板（已读由面板内的单条/全部已读按钮处理，避免一打开就全部标记） */
  function openNotifications() {
    setNotifOpen(true);
  }

  function closeNotifications() {
    setNotifOpen(false);
  }

  return (
    <motion.header
      className="sticky top-0 z-[900] flex h-[3.25rem] items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 transition-[background] duration-300 md:gap-6"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24, mass: 0.8 }}
    >
      <Link
        href="/home"
        className="flex items-center gap-2 whitespace-nowrap text-base font-bold tracking-[-0.02em] text-accent"
      >
        <SafeImg
          src="/head.jpg"
          alt=""
          priority
          sizes="24px"
          className="h-6 w-6 rounded-full ring-1 ring-[var(--color-border-light)]"
        />
        JasonLuo
      </Link>

      {/* 管理入口 — 仅管理员登录后显示 */}
      {isAdmin && (
        <MotionLink
          href="/admin"
          className="cursor-pointer whitespace-nowrap rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          transition={springBtn}
        >
          管理
        </MotionLink>
      )}

      {/* 登录态 — 紧挨品牌名右侧 */}
      {!checking && !user && (
        <button
          type="button"
          onClick={() => { setAuthOpen(true); }}
          className="cursor-pointer whitespace-nowrap rounded-full border border-accent/50 px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
        >
          请登录
        </button>
      )}
      {!checking && user && (
        <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
          <span className="max-w-[6rem] truncate text-sm font-medium text-[var(--color-text)]" title={user.username}>
            {user.username}
          </span>
          {isAdmin && (
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-semibold text-accent">
              管理员
            </span>
          )}
          <button
            type="button"
            onClick={logout}
            className="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs text-text-muted transition-colors hover:border-red-400 hover:text-red-500"
          >
            退出
          </button>

          {/* 消息通知：红色未读徽标 + 下拉列表 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { if (notifOpen) { closeNotifications(); } else { openNotifications(); } }}
              aria-label="消息通知"
              className="relative cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-0.5 text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <i className="iconfont2 icon-tongzhi text-base leading-none" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.625rem] font-bold text-white">
                  {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                </span>
              )}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-[940]" onClick={closeNotifications} />
                  <Suspense fallback={null}>
                    <NotificationPanel onClose={closeNotifications} />
                  </Suspense>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 右侧：主题切换 */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <motion.button
          className="flex cursor-pointer items-center rounded-md border-none bg-transparent p-1.5 text-text-muted transition-[background,color] duration-200 hover:bg-bg-alt hover:text-[var(--color-text)] [&_.iconfont]:text-lg"
          onClick={onToggle}
          aria-label="切换主题"
          whileHover={{ scale: 1.12, rotate: 20 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 12 }}
        >
          <i className={`iconfont ${theme === 'light' ? 'icon-yueliang' : 'icon-taiyang'}`} />
        </motion.button>
      </div>

      {/* 桌面端导航（移动端隐藏） */}
      <nav className="hidden gap-0.5 md:flex">
        {NAV_TABS.map((t) => {
          const isActive = pathname === t.to;
          return (
            <MotionLink
              key={t.to}
              href={t.to}
              className={`${linkBase} ${isActive ? '!font-semibold !text-accent' : ''}`}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.92 }}
              transition={springBtn}
            >
              {t.label}
            </MotionLink>
          );
        })}
      </nav>

      {/* 移动端导航 — AnimatePresence 驱动进出场 */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            className="absolute inset-x-0 top-[3.25rem] flex flex-col gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-3 md:hidden"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.6 }}
          >
            {NAV_TABS.map((t, i) => {
              const isActive = pathname === t.to;
              return (
                <motion.div
                  key={t.to}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 22 }}
                >
                  <MotionLink
                    href={t.to}
                    className={`${linkBase} block py-2 ${isActive ? '!font-semibold !text-accent' : ''}`}
                    onClick={() => {
                      setMenuOpen(false);
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={springBtn}
                  >
                    {t.label}
                  </MotionLink>
                </motion.div>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>

      {/* 汉堡菜单按钮 (仅移动端) */}
      <motion.button
        className="flex cursor-pointer flex-col gap-1 border-none bg-transparent p-1 md:hidden"
        onClick={() => {
          setMenuOpen(!menuOpen);
        }}
        aria-label="菜单"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        <motion.span
          className="block h-0.5 w-5 rounded-[1px] bg-[var(--color-text)]"
          animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        />
        <motion.span
          className="block h-0.5 w-5 rounded-[1px] bg-[var(--color-text)]"
          animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.15 }}
        />
        <motion.span
          className="block h-0.5 w-5 rounded-[1px] bg-[var(--color-text)]"
          animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        />
      </motion.button>

      {/* 登录 / 注册弹窗 */}
      <Suspense fallback={null}>
        <AuthModal open={authOpen} onClose={() => { setAuthOpen(false); }} />
      </Suspense>
    </motion.header>
  );
}
