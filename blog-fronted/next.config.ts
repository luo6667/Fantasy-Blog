import type { NextConfig } from 'next';

/** 独立 Express 后端地址（blog-server，保留前后端分离架构） */
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4000';

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
