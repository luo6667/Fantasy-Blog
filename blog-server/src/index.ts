import http from 'node:http';

import './load-env.js';

import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './db/connect.js';
import { sequelize } from './db/sequelize.js';
import { seedSiteContent } from './services/siteContent.service.js';
import { logger } from './utils/logger.js';

/**
 * 服务启动引导
 *
 * 顺序：加载并校验环境变量（env.ts 内完成）→ 连接 MySQL（自动建库）→
 * 同步表结构（sequelize.sync，已存在则跳过）→ seed 站点内容默认值 →
 * 创建 HTTP server 并监听端口。
 * 任一步失败都会打印明确错误并以非零码退出。
 */
/**
 * 技术栈:Express 5 + TypeScript(NodeNext ESM)+ Sequelize 6 + MySQL 8。
 * 启动顺序见上方注释;HTTP server 由 node:http 创建(为将来挂载 WebSocket 预留,
 * 当前无实时推送,SSE 仅用于 AI 流式对话)。
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
