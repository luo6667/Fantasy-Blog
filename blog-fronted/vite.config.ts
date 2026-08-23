import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // React Compiler：自动记忆化，组件里无需手写 useMemo / useCallback / memo
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // 将 node_modules 依赖拆分成独立 chunk，利于浏览器缓存与并行加载
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-motion': ['motion'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-socket': ['socket.io-client'],
          'vendor-state': ['zustand'],
        },
      },
    },
    // chunk 大小告警阈值（避免告警阈值过大掩盖真实体积问题）
    chunkSizeWarningLimit: 500,
  },

  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
    // 代理后端 API、上传文件与 WebSocket（同源请求，免 CORS）
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
      // Socket.IO 实时推送（私信 / 通知 / 正在输入）
      '/socket.io': { target: 'http://localhost:4000', changeOrigin: true, ws: true },
    },
  },
});
