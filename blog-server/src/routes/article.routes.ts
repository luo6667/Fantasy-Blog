import { Router } from 'express';
import { z } from 'zod';

import {
  createHandler,
  deleteHandler,
  detailHandler,
  likeHandler,
  listHandler,
  tagsHandler,
  updateHandler,
} from '../controllers/article.controller.js';
import {
  createCommentHandler,
  listCommentsHandler,
} from '../controllers/comment.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

/** 创建文章请求体 */
const articleSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(200, '标题最多 200 字'),
  excerpt: z.string().trim().min(1, '摘要不能为空').max(500, '摘要最多 500 字'),
  content: z.string().min(1, '正文不能为空').max(200 * 1024, '正文最多 200KB'),
  tags: z
    .array(z.string().trim().min(1, '标签不能为空').max(32, '单个标签最多 32 个字符'))
    .min(1, '至少选择一个分类标签')
    .max(20, '标签最多 20 个'),
  // 封面图：允许空、绝对 URL、或本地上传的相对路径（/uploads/...）
  cover: z
    .string()
    .refine(
      (s) => s === '' || /^https?:\/\//i.test(s) || s.startsWith('/uploads/'),
      '封面图必须是合法 URL 或 /uploads/ 路径',
    )
    .optional(),
});

/** 更新文章请求体（所有字段可选） */
const updateSchema = articleSchema.partial();

/** 发表评论请求体 */
const commentSchema = z.object({
  content: z.string().trim().min(1, '评论内容不能为空').max(1000, '评论最多 1000 字'),
});

/**
 * 文章路由（RESTful）
 *
 * GET    /api/articles              列表（公开，支持 ?page=&pageSize=&tag=&search=）
 * GET    /api/articles/tags         标签聚合（公开）
 * GET    /api/articles/:id          详情（公开，登录可返回点赞状态）
 * GET    /api/articles/:id/comments 评论列表（公开，登录可返回点赞状态）
 * POST   /api/articles/:id/comments 发表评论（登录，普通用户/管理员均可）
 * POST   /api/articles/:id/like     点赞 / 取消（登录）
 * POST   /api/articles              创建（管理员）
 * PUT    /api/articles/:id          更新（管理员）
 * DELETE /api/articles/:id          删除（管理员）
 */
router.get('/', listHandler);
router.get('/tags', tagsHandler);
router.get('/:id', detailHandler);
router.get('/:id/comments', listCommentsHandler);
router.post('/:id/comments', writeLimiter, requireAuth, validateBody(commentSchema), createCommentHandler);
router.post('/:id/like', writeLimiter, requireAuth, likeHandler);
router.post('/', requireAdmin, validateBody(articleSchema), createHandler);
router.put('/:id', requireAdmin, validateBody(updateSchema), updateHandler);
router.delete('/:id', requireAdmin, deleteHandler);

export default router;
