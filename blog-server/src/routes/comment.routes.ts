import { Router } from 'express';
import { z } from 'zod';

import {
  deleteCommentHandler,
  likeHandler,
  replyHandler,
} from '../controllers/comment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

/** 回复请求体 */
const replySchema = z.object({
  content: z.string().trim().min(1, '回复内容不能为空').max(1000, '回复最多 1000 字'),
});

/**
 * 评论子路由（嵌套在 /api/comments）
 *
 * POST   /api/comments/:id/replies  回复一级评论（登录）
 * POST   /api/comments/:id/like     点赞 / 取消点赞（登录）
 * DELETE /api/comments/:id          删除评论及回复（作者本人或管理员）
 */
router.post('/:id/replies', requireAuth, validateBody(replySchema), replyHandler);
router.post('/:id/like', requireAuth, likeHandler);
router.delete('/:id', requireAuth, deleteCommentHandler);

export default router;
