import { ensureDatabase, sequelize } from './sequelize.js';
import { logger } from '../utils/logger.js';

/**
 * 建立 MySQL 连接
 *
 * 流程：确保数据库存在（不存在则自动创建）→ 验证连接可用。
 */
export async function connectDB(): Promise<void> {
  await ensureDatabase();
  await sequelize.authenticate();
  logger.info('MySQL connected');
}
