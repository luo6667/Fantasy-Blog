import { type ReactNode, Suspense } from 'react';

interface PageSuspenseProps {
  children: ReactNode;
  /** 自定义 loading 占位，默认显示骨架屏 */
  fallback?: ReactNode;
}

/**
 * 页面级 Suspense 边界
 *
 * 包裹懒加载页面，在 chunk 加载期间展示统一的 loading 状态。
 */
function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-text-muted">加载中…</p>
      </div>
    </div>
  );
}

export default function PageSuspense({ children, fallback }: PageSuspenseProps) {
  return <Suspense fallback={fallback ?? <PageLoading />}>{children}</Suspense>;
}
