import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { MotionLink, SafeImg } from '@/components/common';
import { NAV_TABS } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { springBtn } from '@/lib/motion';
import type { ThemeMode } from '@/types';

interface NavProps {
  theme: ThemeMode;
  onToggle: () => void;
}

const linkBase =
  'cursor-pointer border-none bg-transparent px-3 py-1.5 font-[inherit] text-sm font-medium text-text-secondary hover:text-[var(--color-text)]';

/**
 * 顶部导航栏组件
 *
 * - 左上角圆形头像：已登录管理员进入后台，未登录进入管理员登录页
 * - 品牌文字点击回首页
 * - 右侧：主题切换按钮、桌面/移动端导航菜单
 * - 访客页不再显示「请登录」，登录入口只保留在头像
 */
export default function Nav({ theme, onToggle }: NavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAdmin } = useAuth();

  return (
    <motion.header
      className="sticky top-0 z-[900] border-b border-[var(--color-border)] bg-[var(--color-bg)] transition-[background] duration-300"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24, mass: 0.8 }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1040px] items-center gap-3 px-6 md:gap-6">
        <div className="flex shrink-0 items-center gap-2">
          {/* 头像入口：管理员 → 后台；访客 → 管理员登录页 */}
          <MotionLink
            href={isAdmin ? '/admin/articles' : '/admin/login'}
            aria-label={isAdmin ? '进入管理后台' : '管理员登录'}
            className="shrink-0 rounded-full"
            whileTap={{ scale: 0.92 }}
            transition={springBtn}
          >
            <SafeImg src="/head.jpg" alt="" priority sizes="32px" className="h-8 w-8 rounded-full" />
          </MotionLink>

          <Link
            href="/home"
            className="whitespace-nowrap text-lg font-bold tracking-[-0.02em] text-accent"
          >
            Fantasy
          </Link>
        </div>

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
              className="absolute inset-x-0 top-16 flex flex-col gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-3 md:hidden"
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
      </div>
    </motion.header>
  );
}
