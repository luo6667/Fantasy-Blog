import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

/**
 * 📘 next.config.ts —— Next.js 16 配置文件（技术栈：App Router + Turbopack + React 19）
 *
 * 本项目的核心架构是「前后端分离」：
 * - 前端(Next.js)只负责渲染页面，所有数据接口都在 Go 后端(blog-server)；
 * - rewrites 把 /api 与 /uploads 同源代理到后端 —— 浏览器里请求 /api/... 完全无跨域，
 *   前端代码里看不到后端地址；
 * - 后端地址由 API_TARGET 环境变量指定（开发默认 http://localhost:4000）。
 */
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4000';

/**
 * 局域网预览：Next dev 默认只信任 localhost，从 `192.168.x.x:3000` 打开时
 * 会拦截 /_next 开发资源，页面只剩服务端渲染的骨架。
 * 用 DEV_ORIGINS（逗号分隔的主机名，允许 `*.lan` 这类通配）放行。
 */
const DEV_ORIGINS = (process.env.DEV_ORIGINS ?? '192.168.31.85')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: DEV_ORIGINS,
  rewrites() {
    return [
      // API 与上传文件代理到 Go 后端
      { source: '/api/:path*', destination: `${API_TARGET}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_TARGET}/uploads/:path*` },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

export default withBundleAnalyzer(nextConfig);
