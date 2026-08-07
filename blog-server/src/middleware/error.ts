import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';

import { logger } from '../utils/logger.js';

/**
 * 业务异常：controller/service 中主动抛出，携带 HTTP 状态码与业务码。
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: number;

  constructor(status: number, message: string, code?: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code ?? status;
  }
}

/** 404 兜底：未匹配到任何路由时返回统一结构 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    code: 404,
    msg: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
};

/**
 * 全局错误处理中间件（必须 4 参签名，Express 才能识别）
 *
 * 分类处理：
 * - HttpError：业务错误，原样透出状态码
 * - ZodError：请求校验失败
 * - Mongoose 校验/转换错误
 * - 其余未知错误：记日志并返回 500，不向客户端泄露内部细节
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, msg: err.message, data: null });
    return;
  }

  if (err instanceof multer.MulterError) {
    // 文件超限（LIMIT_FILE_SIZE）→ 413，其余 multer 错误 → 400
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ code: status, msg: err.message, data: null });
    return;
  }

  // express.json / urlencoded 请求体解析失败（body-parser 抛 SyntaxError 并带 status < 500）
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status < 500
  ) {
    res.status(400).json({ code: 400, msg: '请求体格式错误', data: null });
    return;
  }

  if (err instanceof ZodError) {
    const msg = err.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    res.status(400).json({ code: 400, msg, data: null });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const msg = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
    res.status(400).json({ code: 400, msg, data: null });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ code: 400, msg: 'Invalid id format', data: null });
    return;
  }

  logger.error(`Unhandled error [${req.method}] ${req.originalUrl}`, {
    type: err instanceof Error ? err.constructor.name : typeof err,
    name: (err as { name?: string } | null)?.name,
    message: err instanceof Error ? err.message : String(err),
    status: (err as { status?: number } | null)?.status,
    code: (err as { code?: string | number } | null)?.code,
  });
  res.status(500).json({ code: 500, msg: 'Internal server error', data: null });
};
