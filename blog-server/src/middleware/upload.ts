import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RequestHandler } from 'express';
import multer from 'multer';

import { env } from '../config/env.js';
import { HttpError } from './error.js';

/**
 * 图片上传中间件（multer）
 *
 * 安全设计：
 * - 使用 memoryStorage 拿到完整 buffer，按文件头（magic bytes）校验真实图片类型，
 *   不信任客户端自报的 Content-Type（可伪造），杜绝上传 HTML/SVG/脚本伪装成图片
 * - 存盘扩展名由检测出的真实类型决定（不用 originalname，防止任意扩展名托管可执行内容）
 * - 大小上限 env.UPLOAD_MAX_SIZE（默认 5MB）
 *
 * 用法：uploadImage = [multer.single('image'), 写盘中间件]，写盘后 req.file.filename 为最终文件名。
 */

const uploadDir = env.UPLOAD_DIR_ABS;
mkdirSync(uploadDir, { recursive: true });

/** 允许的图片类型 → 存盘扩展名（仅 raster 图片，排除可含脚本的 SVG） */
const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** 基于 magic bytes 检测图片类型（返回 MIME，无法识别返回 null） */
function sniffImage(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 6) {
    const head = buf.toString('ascii', 0, 6);
    if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_SIZE, files: 1 },
});

/** 上传单张图片并落盘（multipart 字段名：image），失败会抛出 HttpError 由全局错误中间件处理 */
export const uploadImage: RequestHandler[] = [
  upload.single('image'),
  async (req, _res, next) => {
    const file = req.file;
    if (!file) {
      next();
      return;
    }
    // 注意：multer 的 fileFilter 在内容到达前执行（此时 buffer 为空），
    // 因此文件类型校验必须放在这里：此时 memoryStorage 已把完整内容读入 buffer
    const detected = sniffImage(file.buffer);
    if (!detected) {
      throw new HttpError(400, '无法识别文件内容，仅支持 JPEG/PNG/WebP/GIF 图片');
    }
    if (detected !== file.mimetype) {
      throw new HttpError(400, '文件内容与声明类型不符');
    }
    // 存盘扩展名取检测出的真实类型（不信任 originalname，防止托管任意扩展名内容）
    const filename = `${Date.now()}-${randomUUID()}${MIME_EXT[detected]}`;
    await writeFile(path.join(uploadDir, filename), file.buffer);
    file.filename = filename;
    next();
  },
];
