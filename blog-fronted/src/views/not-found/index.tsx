'use client';

import Link from 'next/link';

import { BgOrbs } from '@/components/common';
import { useSeo } from '@/hooks/useSeo';

/**
 * 404 页面（未匹配任何路由时展示）
 *
 * 独立于 Layout，避免未知 URL 白屏。
 */
export default function NotFound() {
  useSeo({ title: '页面不存在' });

  return (
    <main>
      <BgOrbs />
      <section className="relative z-[1] flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-7xl font-extrabold tracking-[-0.03em] text-accent">404</p>
        <h1 className="mt-4 text-2xl font-bold tracking-[-0.02em]">页面不存在</h1>
        <p className="mt-2 text-sm text-text-muted">你访问的页面可能已被移除或链接有误</p>
        <Link
          href="/"
          className="mt-8 rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          返回首页
        </Link>
      </section>
    </main>
  );
}
