import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * 请求体 zod 校验中间件
 *
 * 校验通过后将解析后的值写回 req.body（类型安全）；
 * 失败抛出 ZodError，由全局错误处理中间件统一返回 400。
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}
