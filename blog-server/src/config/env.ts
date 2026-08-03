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
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
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

/** 校验后的环境变量（类型安全） */
export const env = parsed.data;

export type Env = typeof env;
