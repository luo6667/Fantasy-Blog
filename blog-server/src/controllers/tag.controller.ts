import type { RequestHandler } from 'express';

import { createTag, deleteTag, listTags } from '../services/tag.service.js';
import { ok } from '../utils/response.js';

/**
 * 标签控制器
 *
 * 公开读 + 登录写（写接口由 requireAuth 中间件保护）。
 */

/** GET /api/tags */
export const listHandler: RequestHandler = async (_req, res) => {
  const tags = await listTags();
  ok(res, tags);
};

/** POST /api/tags（JWT） */
export const createHandler: RequestHandler = async (req, res) => {
  const tag = await createTag((req.body as { name: string }).name);
  ok(res, tag, 'Tag created', 201);
};

/** DELETE /api/tags/:name（JWT） */
export const deleteHandler: RequestHandler = async (req, res) => {
  const result = await deleteTag(req.params.name as string);
  ok(res, result, 'Tag deleted');
};
