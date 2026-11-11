'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  const [videoReady, setVideoReady] = useState(false);

  // 路由切换时滚动到顶部（替代原 ScrollToTop 组件）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // 壁纸视频延后到用户首次交互（滚动/触摸/点击）后再挂载：
  // - 首屏不下载、不解码视频，<video> 不会成为 LCP 候选，移动端也能更快出内容；
  // - 用户开始浏览后视频自然接上，观感与「一直播放」几乎无差别。
  useEffect(() => {
    if (pathname !== '/home' || videoReady) return;
    const startVideo = () => { setVideoReady(true); };
    const events = ['pointerdown', 'pointermove', 'scroll', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, startVideo, { once: true, passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, startVideo);
    };
  }, [pathname, videoReady]);

  return (
    <>
      <ScrollProgress />
      <Nav theme={theme} onToggle={toggleTheme} />
      <div className="relative">
        {/* 动态壁纸视频 — 仅主页，覆盖内容区，底部渐变消失衔接 Footer */}
        {pathname === '/home' && (
          <>
            {/* 首屏先出静态海报（CSS 背景不参与 LCP 判定），空闲后再挂载视频 */}
            <div
              aria-hidden
              className="hero-wallpaper pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.25]"
            />
            {videoReady && (
              <video
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.25]"
                src="/media/hero-loop.mp4"
                poster="/media/hero-poster.jpg"
                preload="none"
                autoPlay
                loop
                muted
                playsInline
                disablePictureInPicture
                disableRemotePlayback
                aria-hidden
                tabIndex={-1}
              />
            )}
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
        {/* 不做整页透明度入场：首屏内容要立刻可见，避免把 LCP 推迟到 hydration 之后 */}
        <div key={pathname}>{children}</div>
      </div>
      <Footer />
    </>
  );
}
