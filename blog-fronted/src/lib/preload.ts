/**
 * 路由预加载工具
 *
 * 在用户 hover 链接时提前加载目标页面的 chunk，
 * 配合 React.lazy 使用，点击时页面已就绪，消除加载闪烁。
 */

const pageLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/home'),
  '/blog': () => import('@/pages/blog'),
  '/resume': () => import('@/pages/resume'),
  '/about': () => import('@/pages/about'),
  '/admin': () => import('@/pages/admin'),
};

/** 已触发过预加载的路径集合，避免重复 import */
const preloaded = new Set<string>();

export function preloadRoute(path: string): void {
  const loader = pageLoaders[path];
  if (loader && !preloaded.has(path)) {
    preloaded.add(path);
    void loader();
  }
}
