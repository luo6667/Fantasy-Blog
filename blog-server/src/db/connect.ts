import mongoose from 'mongoose';

import { logger } from '../utils/logger.js';

/**
 * 建立 MongoDB 连接
 *
 * @param uri 连接串（来自 env.MONGODB_URI）
 */
export async function connectDB(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('MongoDB connected');
}
