import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import multer from 'multer';

import { env } from '../config/env.js';
import { HttpError } from './error.js';

/**
 * multer 上传中间件
 *
 * - 存储到 env.UPLOAD_DIR（相对项目根，自动创建）
 * - 文件名：时间戳 + 随机 UUID + 原扩展名（避免冲突与路径注入）
 * - 仅允许常见图片类型，大小上限 env.UPLOAD_MAX_SIZE
 */

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, 'Only image files are allowed'));
    }
  },
});

/** 上传单张图片（multipart 字段名：image） */
export const uploadImage = upload.single('image');
