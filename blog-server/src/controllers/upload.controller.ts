import type { RequestHandler } from 'express';

import { HttpError } from '../middleware/error.js';
import { ok } from '../utils/response.js';

/**
 * 图片上传控制器
 *
 * 返回相对 URL（/uploads/xxx），开发环境由前端 Vite 代理访问，
 * 生产环境由反代或 CDN 指向该路径。
 */
export const uploadHandler: RequestHandler = (req, res) => {
  const file = req.file;
  if (!file) {
    throw new HttpError(400, 'No file uploaded');
  }
  ok(
    res,
    {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    },
    'Uploaded successfully',
    201,
  );
};
