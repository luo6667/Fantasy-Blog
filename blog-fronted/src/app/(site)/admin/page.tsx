'use client';

import { Suspense } from 'react';

import Admin from '@/views/admin';

/**
 * /admin 页面：Admin 内部使用 useSearchParams（next/navigation），
 * 必须包在 Suspense 边界内，否则 Next.js 预渲染会报错。
 */
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  );
}
