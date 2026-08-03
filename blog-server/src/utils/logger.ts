/**
 * 轻量结构化日志
 *
 * 统一输出格式：[ISO 时间] [级别] 消息 [可选元数据]
 * 生产环境可平滑替换为 pino / winston，调用方无需改动。
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function format(level: LogLevel, msg: string, meta?: unknown): string {
  const time = new Date().toISOString();
  const metaStr =
    meta === undefined
      ? ''
      : ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`;
  return `[${time}] [${level.toUpperCase()}] ${msg}${metaStr}`;
}

export const logger = {
  debug: (msg: string, meta?: unknown) => console.debug(format('debug', msg, meta)),
  info: (msg: string, meta?: unknown) => console.info(format('info', msg, meta)),
  warn: (msg: string, meta?: unknown) => console.warn(format('warn', msg, meta)),
  error: (msg: string, meta?: unknown) => console.error(format('error', msg, meta)),
};
