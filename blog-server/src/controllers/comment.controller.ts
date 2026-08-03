import type { RequestHandler } from 'express';

import { verifyToken } from '../services/auth.service.js';
import {
  createComment,
  createReply,
  deleteComment,
  listComments,
  toggleLike,
} from '../services/comment.service.js';
import { ok } from '../utils/response.js';

/**
 * 评论控制器
 *
 * 列表公开（可选登录态返回点赞状态），发表/回复/点赞/删除需登录。
 */

/** GET /api/articles/:id/comments（可选 token 以返回点赞状态） */
export const listCommentsHandler: RequestHandler = async (req, res) => {
  let currentUser;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      currentUser = await verifyToken(header.slice('Bearer '.length));
    } catch {
      /* 无效 token 按未登录处理 */
    }
  }
  const comments = await listComments(req.params.id as string, currentUser);
  ok(res, comments);
};

/** POST /api/articles/:id/comments（登录） */
export const createCommentHandler: RequestHandler = async (req, res) => {
  const comment = await createComment(
    req.params.id as string,
    req.user!,
    (req.body as { content: string }).content,
  );
  ok(res, comment, '评论成功', 201);
};

/** POST /api/comments/:id/replies（登录） */
export const replyHandler: RequestHandler = async (req, res) => {
  const comment = await createReply(
    req.params.id as string,
    req.user!,
    (req.body as { content: string }).content,
  );
  ok(res, comment, '回复成功', 201);
};

/** POST /api/comments/:id/like（登录，点赞/取消） */
export const likeHandler: RequestHandler = async (req, res) => {
  const result = await toggleLike(req.params.id as string, req.user!);
  ok(res, result);
};

/** DELETE /api/comments/:id（作者本人或管理员） */
export const deleteCommentHandler: RequestHandler = async (req, res) => {
  const result = await deleteComment(req.params.id as string, req.user!);
  ok(res, result, '评论已删除');
};
