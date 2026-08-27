import '@/index.css';

import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Script from 'next/script';

import QueryProvider from '@/components/providers/QueryProvider';

/**
 * 📘 app/layout.tsx —— 根布局（Server Component，无 'use client'）
 *
 * App Router 约定：layout.tsx 包裹所有页面，这里是全站 HTML 骨架，四个技术要点：
 * - next/font：Outfit 字体构建时自托管，零运行时字体请求（消除 FOUT/FOIT）；
 * - metadata 导出：静态 SEO 信息（标题/描述/OG 图），服务端渲染直接输出到 HTML；
 * - 主题初始化：beforeInteractive 内联脚本在 React 加载前同步 <html data-theme>，
 *   避免暗色用户首屏闪白（读 localStorage）；
 * - QueryProvider 是 client 组件，作为全局 Provider 注入 TanStack Query。
 */
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://your-domain.com'), // 上线前替换为真实域名
  title: 'JasonLuo · 个人简历',
  description: 'JasonLuo - 前端工程师个人简历与博客',
  icons: { icon: '/head.jpg' },
  openGraph: {
    siteName: 'JasonLuo',
    title: 'JasonLuo · 个人简历',
    description: 'JasonLuo - 前端工程师个人简历与博客',
    images: ['/head.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={outfit.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#faf9f7" />
        <meta name="color-scheme" content="light dark" />
        <link rel="stylesheet" href="/font/iconfont.css" />
        <link rel="stylesheet" href="/font/iconfont2.css" />
      </head>
      <body>
        {/* 主题初始化：在 CSS 与 React 加载前同步设置 data-theme，避免暗色用户首屏闪白 */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}`}
        </Script>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
