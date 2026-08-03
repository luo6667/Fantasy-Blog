import { ErrorBoundary } from '@/components/common';
import AppRouter from '@/router';

/**
 * 应用根组件
 *
 * 职责：
 * 1. 提供全局 ErrorBoundary 兜底
 * 2. 挂载路由模块
 */
export default function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}
