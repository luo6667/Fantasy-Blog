/**
 * PM2 进程定义 —— 由 deploy/deploy.sh 通过 pm2 startOrReload 引用
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
const UPLOADS = path.join(ROOT, 'shared', 'uploads');

/** 公共字段 */
const common = {
  exec_mode: 'fork',
  instances: 1,
  autorestart: true,
  max_restarts: 10,
  kill_timeout: 8000,
  merge_logs: true,
  time: true,
  env: {
    NODE_ENV: 'production',
    TZ: 'Asia/Shanghai',
  },
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'blog-server',
      cwd: path.join(CURRENT, 'blog-server'),
      script: 'dist/index.js',
      max_memory_restart: '700M',
      env: {
        ...common.env,
        // uploads 固定放 shared/，不在发布目录里，回滚不丢图。
        // dotenv 不会覆盖已存在的环境变量，所以这里的优先级高于 .env。
        UPLOAD_DIR: UPLOADS,
      },
      out_file: path.join(LOGS, 'blog-server.out.log'),
      error_file: path.join(LOGS, 'blog-server.err.log'),
    },
    {
      ...common,
      name: 'blog-web',
      cwd: path.join(CURRENT, 'blog-fronted'),
      // 直接用 next 的 CLI 入口（比 npm run start 少一层 npm 进程，reload 不留孤儿进程）
      script: path.join(CURRENT, 'blog-fronted', 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -p 3000',
      interpreter: 'node',
      max_memory_restart: '1G',
      env: {
        ...common.env,
        // 服务端取数（SSG/SSR）直连本机后端；浏览器侧走同源 /api
        API_TARGET: 'http://127.0.0.1:4000',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      out_file: path.join(LOGS, 'blog-web.out.log'),
      error_file: path.join(LOGS, 'blog-web.err.log'),
    },
  ],
};
