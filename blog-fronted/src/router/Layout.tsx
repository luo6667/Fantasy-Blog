import { AnimatePresence, motion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';

import ScrollProgress from '@/components/common/ScrollProgress';
import Footer from '@/components/layout/Footer';
import Nav from '@/components/layout/Nav';
import { useTheme } from '@/hooks/useTheme';
import ScrollToTop from '@/router/ScrollToTop';

/**
 * 全局布局：滚动进度条 + 顶栏 + 路由过渡动画 + 内容区 + 底栏
 */
export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <>
      <ScrollProgress />
      <ScrollToTop />
      <Nav theme={theme} onToggle={toggleTheme} />
      <div className="relative">
        {/* 动态壁纸视频 — 仅主页，覆盖内容区，底部渐变消失衔接 Footer */}
        {location.pathname === '/home' && (
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
        <AnimatePresence mode="popLayout">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </>
  );
}
