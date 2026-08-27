import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * 📘 middleware/validate.ts —— 请求体校验中间件（技术栈：zod）
 *
 * 用法：路由里 validateBody(createArticleSchema) —— schema 描述"合法参数长什么样"。
 * 校验通过：把解析后的值写回 req.body（类型安全）；校验失败：抛 ZodError，
 * 由全局错误处理中间件(middleware/error.ts)统一返回 400。路由代码因此不用手写参数判断。
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}
