'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import ScrollProgress from '@/components/common/ScrollProgress';
import Footer from '@/components/layout/Footer';
import Nav from '@/components/layout/Nav';
import { useTheme } from '@/hooks/useTheme';

/**
 * 📘 app/(site)/layout.tsx —— 主站布局（Client Component，路由组 (site) 的共享外壳）
 *
 * (site) 是 App Router 的「路由组」：括号目录不参与 URL，但其中的 layout 会包住
 * 组内所有页面（home/blog/about/resume/admin）。这里提供：
 * - 滚动进度条 + 顶栏 Nav + 底栏 Footer（整站共享）；
 * - 路由切换淡入动画：以 pathname 为 key 重触发 motion.div（App Router 无 exit 动画，只做进入）；
 * - 路由切换滚动回顶（替代原 SPA 的 ScrollToTop）；
 * - 首页专属的动态壁纸视频背景。
 * 整个布局是 client 组件：首屏 HTML 仍由 SSR 输出，交互逻辑在客户端。
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  // 路由切换时滚动到顶部（替代原 ScrollToTop 组件）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <ScrollProgress />
      <Nav theme={theme} onToggle={toggleTheme} />
      <div className="relative">
        {/* 动态壁纸视频 — 仅主页，覆盖内容区，底部渐变消失衔接 Footer */}
        {pathname === '/home' && (
          <>
            <video
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.25]"
              src="https://duoduowallpaper.fp.ps.netease.com/file/69bb8a28de0dcc60eb2d8269RP1ihqEK07"
              autoPlay
              loop
              muted
              playsInline
            />
            {/* 渐变遮罩：顶部微遮保证可读 → 中段通透 → 底部渐隐衔接 Footer */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, var(--color-bg) 0%, transparent 18%, transparent 78%, var(--color-bg) 100%)',
                opacity: 0.45,
              }}
            />
          </>
        )}
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </div>
      <Footer />
    </>
  );
}
