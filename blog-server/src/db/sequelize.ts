import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Sequelize 单例（MySQL）
 *
 * 所有模型共享同一个实例；连接目标库 env.MYSQL_DATABASE（默认 jianli）。
 * 数组字段（tags / likedBy / favoritedBy / participants）与 SiteContent.value
 * 使用 MySQL 原生 JSON 列存储，保持与旧 MongoDB 文档一致的数据结构。
 */
export const sequelize = new Sequelize(env.MYSQL_DATABASE, env.MYSQL_USER, env.MYSQL_PASSWORD, {
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  dialect: 'mysql',
  logging: false,
  timezone: '+08:00',
  define: {
    // 表名 / 列名统一使用 camelCase，保持与业务代码字段命名一致
    underscored: false,
  },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

/**
 * 确保目标数据库存在（root 账号权限足够；库不存在则自动创建）
 *
 * 连接时若库不存在，Sequelize 会直接报错，因此先用不带库名的连接
 * 执行 CREATE DATABASE IF NOT EXISTS，再让应用走正常连接。
 */
export async function ensureDatabase(): Promise<void> {
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
  });
  try {
    // 库名来自环境配置而非用户输入，反引号包裹即可安全使用
    const dbName = env.MYSQL_DATABASE.replace(/`/g, '');
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    logger.info(`MySQL database ready: ${dbName}`);
  } finally {
    await conn.end();
  }
}

export default sequelize;
