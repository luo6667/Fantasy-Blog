'use client';

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
 * - 路由切换滚动回顶（替代原 SPA 的 ScrollToTop）；
 * - 不做整页 opacity 入场：首屏内容要立刻可见，避免把 LCP 推迟到 hydration 之后。
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
      <div key={pathname}>{children}</div>
      <Footer />
    </>
  );
}
