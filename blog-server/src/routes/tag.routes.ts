import { Router } from 'express';
import { z } from 'zod';

import {
  createHandler,
  deleteHandler,
  listHandler,
} from '../controllers/tag.controller.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

/** 新增标签请求体 */
const tagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '标签名不能为空')
    .max(32, '标签名最多 32 个字符')
    .transform((s) => s.replace(/\s+/g, '')),
});

/**
 * 标签路由
 *
 * GET    /api/tags       标签库列表（公开，含文章数）
 * POST   /api/tags       新增标签（JWT）
 * DELETE /api/tags/:name 删除标签（JWT，同步从文章移除）
 */
router.get('/', listHandler);
router.post('/', requireAdmin, validateBody(tagSchema), createHandler);
router.delete('/:name', requireAdmin, deleteHandler);

export default router;
