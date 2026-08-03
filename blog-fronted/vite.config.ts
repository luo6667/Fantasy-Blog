import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // 将 node_modules 依赖拆分成独立 chunk，利于浏览器缓存
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-router': ['react-router-dom'],
          'vendor-motion': ['motion'],
        },
      },
    },
    // 提高 chunk 大小警告阈值（motion 库较大）
    chunkSizeWarningLimit: 600,
  },

  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
    // 代理后端 API 与上传文件（同源请求，免 CORS）
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
