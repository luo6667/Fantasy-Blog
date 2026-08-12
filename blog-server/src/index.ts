import http from 'node:http';

import './load-env.js';

import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './db/connect.js';
import { migrateConversations } from './db/migrate.js';
import { seedSiteContent } from './services/siteContent.service.js';
import { initSocket } from './socket.js';
import { logger } from './utils/logger.js';

/**
 * 服务启动引导
 *
 * 顺序：加载并校验环境变量（env.ts 内完成）→ 连接 MongoDB → 会话数据迁移（修复旧唯一索引）
 * → seed 站点内容默认值 → 创建 HTTP server 并挂载 Socket.IO（私信/通知实时推送）→ 监听端口。
 * 任一步失败都会打印明确错误并以非零码退出。
 */
async function bootstrap(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  await migrateConversations();
  await seedSiteContent();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.PORT, () => {
    logger.info(`Server started: http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err: unknown) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
