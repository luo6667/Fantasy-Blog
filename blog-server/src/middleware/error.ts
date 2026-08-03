import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
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

  logger.error(`Unhandled error [${req.method}] ${req.originalUrl}`, err);
  res.status(500).json({ code: 500, msg: 'Internal server error', data: null });
};
