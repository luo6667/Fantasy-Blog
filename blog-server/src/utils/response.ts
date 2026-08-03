import type { Response } from 'express';

/**
 * 统一全局返回结构：{ code, msg, data }
 *
 * - code: 业务码，0 表示成功，非 0 表示业务失败（默认等于 HTTP 状态码）
 * - msg: 人类可读信息
 * - data: 业务数据，失败时为 null
 */

export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

/** 成功响应 */
export function ok<T>(res: Response, data: T, msg = 'success', status = 200): void {
  const body: ApiResponse<T> = { code: 0, msg, data };
  res.status(status).json(body);
}

/** 失败响应 */
export function fail(res: Response, msg: string, status = 400, code = status): void {
  const body: ApiResponse<null> = { code, msg, data: null };
  res.status(status).json(body);
}
