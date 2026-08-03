import type { RequestHandler } from 'express';

import {
  createArticle,
  deleteArticle,
  getArticle,
  listArticles,
  listTags,
  updateArticle,
} from '../services/article.service.js';
import type { CreateArticleInput, UpdateArticleInput } from '../types/article.js';
import { ok } from '../utils/response.js';

/**
 * 文章控制器
 *
 * 公开读 + 登录写（写接口由 requireAuth 中间件保护）。
 */

/** GET /api/articles?page=&pageSize=&tag= */
export const listHandler: RequestHandler = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
  const result = await listArticles({ page, pageSize, tag });
  ok(res, result);
};

/** GET /api/articles/tags */
export const tagsHandler: RequestHandler = async (_req, res) => {
  const tags = await listTags();
  ok(res, tags);
};

/** GET /api/articles/:id */
export const detailHandler: RequestHandler = async (req, res) => {
  const article = await getArticle(req.params.id as string);
  ok(res, article);
};

/** POST /api/articles（JWT） */
export const createHandler: RequestHandler = async (req, res) => {
  const article = await createArticle(req.body as CreateArticleInput);
  ok(res, article, 'Article created', 201);
};

/** PUT /api/articles/:id（JWT） */
export const updateHandler: RequestHandler = async (req, res) => {
  const article = await updateArticle(req.params.id as string, req.body as UpdateArticleInput);
  ok(res, article, 'Article updated');
};

/** DELETE /api/articles/:id（JWT） */
export const deleteHandler: RequestHandler = async (req, res) => {
  const result = await deleteArticle(req.params.id as string);
  ok(res, result, 'Article deleted');
};
