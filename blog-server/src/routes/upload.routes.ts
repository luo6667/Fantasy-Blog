import { Router } from 'express';

import { uploadHandler } from '../controllers/upload.controller.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();

/**
 * 上传路由
 *
 * POST /api/upload  上传单张图片（管理员 + multipart，字段名 image）
 */
router.post('/', requireAdmin, uploadImage, uploadHandler);

export default router;
