import { Suspense } from 'react';

import Admin from '@/views/admin';

/**
 * /admin 页面：Admin 内部使用 useSearchParams（next/navigation），
 * 必须包在 Suspense 边界内，否则 Next.js 预渲染会报错。
 * force-dynamic：管理后台涉及登录与写操作，禁止静态化/缓存
 * （route segment config 只能在 Server Component 导出，故本页不能标 'use client'）。
 */
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  );
}
