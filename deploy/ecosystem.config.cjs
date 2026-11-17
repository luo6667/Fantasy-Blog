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
      cwd: path.join(CURRENT, 'blog-fronted', '.next', 'standalone'),
      // standalone 产物自带最小 node_modules；直接跑 server.js，不依赖 next CLI 与 npm
      script: path.join(CURRENT, 'blog-fronted', '.next', 'standalone', 'server.js'),
      args: '',
      interpreter: 'node',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Shanghai',
        // standalone 用 PORT/HOSTNAME 监听；服务端取数直连本机 Go 后端
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
        API_TARGET: 'http://127.0.0.1:4000',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      out_file: path.join(LOGS, 'blog-web.out.log'),
      error_file: path.join(LOGS, 'blog-web.err.log'),
    },
  ],
};
