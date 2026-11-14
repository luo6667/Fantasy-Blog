/**
 * PM2 进程定义 —— 只负责 Next.js 前端（blog-web）
 *
 * 后端是 Go，由 systemd 单元 blog-server.service 管理（见
 * blog-server/deploy/systemd/blog-server.service），不在这里出现。
 *
 * 关键点：cwd 指向 current 软链。发布时切换软链再 reload，
 * 新进程的 cwd 就解析到新的发布目录，旧发布目录随时可以回滚。
 *
 * 注意：pm2 会把 cwd 记成字符串 "{APP_ROOT}/current/xxx"，
 * 真正 chdir 发生在进程启动那一刻，所以切软链后必须 reload 才生效。
 */
const path = require('node:path');

const ROOT = process.env.BLOG_ROOT || '/www/wwwroot/personal-blog';
const CURRENT = path.join(ROOT, 'current');
const LOGS = path.join(ROOT, 'logs');

module.exports = {
  apps: [
    {
      name: 'blog-web',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
      cwd: path.join(CURRENT, 'blog-fronted'),
      // 直接用 next 的 CLI 入口（比 npm run start 少一层 npm 进程，reload 不留孤儿进程）
      script: path.join(CURRENT, 'blog-fronted', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -p 3000 -H 127.0.0.1',
      interpreter: 'node',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Shanghai',
        // 服务端取数（SSG/SSR）直连本机 Go 后端；浏览器侧走同源 /api
        API_TARGET: 'http://127.0.0.1:4000',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      out_file: path.join(LOGS, 'blog-web.out.log'),
      error_file: path.join(LOGS, 'blog-web.err.log'),
    },
  ],
};
