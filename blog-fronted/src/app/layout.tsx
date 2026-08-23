import '@/index.css';

import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Script from 'next/script';

import QueryProvider from '@/components/providers/QueryProvider';

/** Outfit 字体：next/font 构建时自托管（无运行时外部请求，无 FOUT/FOIT） */
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
    <html lang="zh-CN" className={outfit.variable} suppressHydrationWarning>
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
