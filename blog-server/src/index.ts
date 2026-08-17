import http from 'node:http';

import './load-env.js';

import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './db/connect.js';
import { sequelize } from './db/sequelize.js';
import Message from './models/Message.js';
import { seedSiteContent } from './services/siteContent.service.js';
import { initSocket } from './socket.js';
import { logger } from './utils/logger.js';
import { Op } from 'sequelize';

/** 私信消息保留天数（与原 MongoDB TTL 索引一致：180 天自动清理） */
const MESSAGE_TTL_DAYS = 180;
/** 清理周期 */
const CLEANUP_INTERVAL_MS = 24 * 3600 * 1000;

/** 清理过期私信消息（MySQL 无 TTL 索引，用定时删除替代） */
async function cleanupExpiredMessages(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - MESSAGE_TTL_DAYS * 24 * 3600 * 1000);
    const deleted = await Message.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
    if (deleted > 0) {
      logger.info(`[cleanup] 已清理 ${deleted} 条超过 ${MESSAGE_TTL_DAYS} 天的私信消息`);
    }
  } catch (err) {
    logger.error('清理过期私信消息失败', err);
  }
}

/**
 * 服务启动引导
 *
 * 顺序：加载并校验环境变量（env.ts 内完成）→ 连接 MySQL（自动建库）→
 * 同步表结构（sequelize.sync，已存在则跳过）→ seed 站点内容默认值 →
 * 创建 HTTP server 并挂载 Socket.IO（私信/通知实时推送）→ 监听端口。
 * 任一步失败都会打印明确错误并以非零码退出。
 */
async function bootstrap(): Promise<void> {
  await connectDB();
  // 建表（IF NOT EXISTS 语义，不触碰已存在的数据）
  await sequelize.sync();
  await seedSiteContent();
  // 启动时立即清理一次过期私信，之后每 24h 轮询
  await cleanupExpiredMessages();
  setInterval(() => void cleanupExpiredMessages(), CLEANUP_INTERVAL_MS);
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
