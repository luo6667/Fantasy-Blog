import { Router } from 'express';
import { z } from 'zod';

import { sendMessageHandler } from '../controllers/conversation.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

/** 发送私信请求体 */
const messageSchema = z.object({
  recipientType: z.enum(['user', 'admin']),
  recipientId: z.string().min(1, 'recipientId 不能为空'),
  content: z.string().trim().min(1, '消息内容不能为空').max(1000, '消息最多 1000 字'),
});

/**
 * 消息路由（登录）
 *
 * POST /api/messages 发送私信（自动创建/复用会话，对方在线实时推送）
 */
router.post('/', requireAuth, validateBody(messageSchema), sendMessageHandler);

export default router;
