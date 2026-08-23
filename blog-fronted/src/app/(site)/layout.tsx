'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import ScrollProgress from '@/components/common/ScrollProgress';
import Footer from '@/components/layout/Footer';
import Nav from '@/components/layout/Nav';
import { useTheme } from '@/hooks/useTheme';

/**
 * 主站布局（App Router 路由组 (site)）：
 * 滚动进度条 + 顶栏 + 页面淡入 + 内容区 + 底栏。
 * 对应原 SPA 的 router/Layout.tsx；路由过渡动画简化为淡入（App Router 无 exit 动画）。
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
