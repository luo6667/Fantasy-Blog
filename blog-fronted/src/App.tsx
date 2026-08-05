import { ErrorBoundary } from '@/components/common';
import ChatProvider from '@/components/providers/ChatProvider';
import AppRouter from '@/router';

/**
 * 应用根组件
 *
 * 职责：
 * 1. 提供全局 ErrorBoundary 兜底
 * 2. ChatProvider：登录后建立 Socket.IO 连接（私信/通知实时推送）
 * 3. 挂载路由模块
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ChatProvider>
        <AppRouter />
      </ChatProvider>
    </ErrorBoundary>
  );
}
