'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义错误回退 UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 错误边界组件
 *
 * 捕获子树中任意位置的渲染期异常，防止整个应用白屏。
 * React 19 仍需要使用类组件实现错误边界（尚无 Hook 版本）。
 *
 * 使用方式：
 *   <ErrorBoundary fallback={<p>出错了</p>}>
 *     <DangerousComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[50vh] items-center justify-center px-6 py-20">
            <div className="text-center">
              <h2 className="mb-2 text-xl font-bold">页面出现了异常</h2>
              <p className="mb-4 text-text-muted text-sm">
                {this.state.error?.message ?? '未知错误'}
              </p>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); }}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
                type="button"
              >
                重试
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
