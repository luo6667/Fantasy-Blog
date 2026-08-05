import { Router } from 'express';

import {
  listConversationsHandler,
  listMessagesHandler,
  markConversationReadHandler,
} from '../controllers/conversation.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * 会话路由（登录）
 *
 * GET  /api/conversations              会话列表
 * GET  /api/conversations/:id/messages 历史消息
 * POST /api/conversations/:id/read     标记已读
 */
router.get('/', requireAuth, listConversationsHandler);
router.get('/:id/messages', requireAuth, listMessagesHandler);
router.post('/:id/read', requireAuth, markConversationReadHandler);

export default router;
