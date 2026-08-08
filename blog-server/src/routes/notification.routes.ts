import { Router } from 'express';
import { z } from 'zod';

import {
  listHandler,
  markReadHandler,
  unreadCountHandler,
} from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

/** 标记已读请求体（ids 可选，缺省标记全部） */
const readSchema = z.object({
  ids: z.array(z.string().min(1)).max(100, '单次最多标记 100 条').optional(),
});

/**
 * 通知路由（登录）
 *
 * GET  /api/notifications               列表
 * GET  /api/notifications/unread-count  未读数
 * POST /api/notifications/read          标记已读
 */
router.get('/', requireAuth, listHandler);
router.get('/unread-count', requireAuth, unreadCountHandler);
router.post('/read', requireAuth, validateBody(readSchema), markReadHandler);

export default router;
