import type { NextConfig } from 'next';

/** 独立 Express 后端地址（blog-server，保留前后端分离架构） */
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4000';

/**
 * Next.js 配置
 *
 * 技术栈:Next.js 16 (App Router, Turbopack) + React 19。
 * 架构:前后端分离 —— 前端只负责渲染,数据接口走 Express 后端(blog-server)。
 * rewrites 把 /api 与 /uploads 同源代理到后端,浏览器无需感知跨域
 * (CORS 仅在后端被直连时才会涉及);生产环境通过 API_TARGET 环境变量指向后端地址。
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  rewrites() {
    return [
      // API 与上传文件代理到 Express 后端
      { source: '/api/:path*', destination: `${API_TARGET}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_TARGET}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
