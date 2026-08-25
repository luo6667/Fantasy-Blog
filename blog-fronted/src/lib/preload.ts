/**
 * 路由预加载工具
 *
 * 在用户 hover 链接时提前加载目标页面的 chunk，
 * 配合 React.lazy 使用，点击时页面已就绪，消除加载闪烁。
 */

/**
 * ⚠️ Vite → Next.js 迁移残留:
 * 这套 React.lazy + 手动 import 预加载是 Vite SPA 时代的方案。App Router 中路由
 * 由文件系统自动注册,Next.js 自带代码分割与链接预取,pageLoaders 的手动 import
 * 会与路由 chunk 重复打包。当前仅 Nav 的 preloadRoute('/admin') 还在调用,
 * 功能无害但已无实际收益,后续可整体移除。
 */
const pageLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/views/cover'),
  '/home': () => import('@/views/home'),
  '/blog': () => import('@/views/blog'),
  '/resume': () => import('@/views/resume'),
  '/about': () => import('@/views/about'),
  '/admin': () => import('@/views/admin'),
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
