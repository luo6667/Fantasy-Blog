import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

/**
 * 环境变量校验
 *
 * 所有敏感配置来自 .env，启动时用 zod 强校验：
 * 缺失、类型错误、长度不足都会在进程启动前报错退出，避免带病运行。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // MySQL 连接配置（业务数据库）
  MYSQL_HOST: z.string().min(1).default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1).default('root'),
  MYSQL_PASSWORD: z.string().default('1234'),
  MYSQL_DATABASE: z.string().min(1, 'MYSQL_DATABASE is required').default('jianli'),
  /** 仅数据迁移脚本（scripts/migrate-mongodb-to-mysql.ts）读取旧 MongoDB 数据时使用 */
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  /** 可选：seed 脚本创建/重置管理员时使用的初始密码（不设置则随机生成并打印） */
  ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  UPLOAD_MAX_SIZE: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // 未初始化 logger 前直接用 console，避免循环依赖
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

/**
 * 项目根目录：基于当前文件位置推导（src/config/env.ts 与 dist/config/env.js 均上溯两级），
 * 与启动时的工作目录无关，避免因 cwd 不同导致上传/静态目录解析错位。
 */
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

/** 校验后的环境变量（类型安全） */
export const env = {
  ...parsed.data,
  /** 上传目录的绝对路径（dev 与 dist 构建均稳定指向项目根/uploads） */
  UPLOAD_DIR_ABS: path.resolve(projectRoot, parsed.data.UPLOAD_DIR),
};

export type Env = typeof env;
