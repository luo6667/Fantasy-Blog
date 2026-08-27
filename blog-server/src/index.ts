import http from 'node:http';

import './load-env.js';

import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './db/connect.js';
import { sequelize } from './db/sequelize.js';
import { seedSiteContent } from './services/siteContent.service.js';
import { logger } from './utils/logger.js';

/**
 * 📘 index.ts —— 服务启动引导（技术栈：Express 5 + TypeScript(NodeNext ESM) + Sequelize 6 + MySQL 8）
 *
 * 启动顺序（每步失败都会打印明确错误并以非零码退出）：
 * 1. load-env：加载 .env 并校验环境变量（config/env.ts，zod 强校验）；
 * 2. connectDB()：连接 MySQL，库不存在则自动创建；
 * 3. sequelize.sync()：按 models/ 定义建表（IF NOT EXISTS 语义，不动已有数据）；
 * 4. seedSiteContent()：写入站点内容的默认值；
 * 5. http.createServer(app)：HTTP server 由 node:http 创建（为将来挂 WebSocket 预留，
 *    当前无实时推送，SSE 仅用于 AI 流式对话）并监听端口。
 */
async function bootstrap(): Promise<void> {
  await connectDB();
  // 建表（IF NOT EXISTS 语义，不触碰已存在的数据）
  await sequelize.sync();
  await seedSiteContent();
  const server = http.createServer(app);
  server.listen(env.PORT, () => {
    logger.info(`Server started: http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err: unknown) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
