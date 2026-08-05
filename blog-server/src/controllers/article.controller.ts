import type { RequestHandler } from 'express';

import { verifyToken } from '../services/auth.service.js';
import {
  createArticle,
  deleteArticle,
  getArticle,
  listArticles,
  listFavoriteArticles,
  listTags,
  toggleArticleFavorite,
  toggleArticleLike,
  updateArticle,
} from '../services/article.service.js';
import type { AuthUser } from '../types/auth.js';
import type { CreateArticleInput, UpdateArticleInput } from '../types/article.js';
import { ok } from '../utils/response.js';

/**
 * 文章控制器
 *
 * 公开读 + 登录写（写接口由 requireAuth 中间件保护）。
 * 列表/详情可选携带 token，返回当前用户的点赞/收藏状态。
 */

/** 可选解析 token（无效则视为未登录） */
async function optionalUser(req: { headers: { authorization?: string } }): Promise<AuthUser | undefined> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    return await verifyToken(header.slice('Bearer '.length));
  } catch {
    return undefined;
  }
}

/** GET /api/articles?page=&pageSize=&tag=&search= */
export const listHandler: RequestHandler = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const currentUser = await optionalUser(req);
  const result = await listArticles({ page, pageSize, tag, search }, currentUser);
  ok(res, result);
};

/** GET /api/articles/tags */
export const tagsHandler: RequestHandler = async (_req, res) => {
  const tags = await listTags();
  ok(res, tags);
};

/** GET /api/articles/favorites（登录，我的收藏） */
export const favoritesHandler: RequestHandler = async (req, res) => {
  ok(res, await listFavoriteArticles(req.user!));
};

/** GET /api/articles/:id（可选 token 返回点赞/收藏状态） */
export const detailHandler: RequestHandler = async (req, res) => {
  const currentUser = await optionalUser(req);
  const article = await getArticle(req.params.id as string, currentUser);
  ok(res, article);
};

/** POST /api/articles/:id/like（登录，点赞/取消） */
export const likeHandler: RequestHandler = async (req, res) => {
  const result = await toggleArticleLike(req.params.id as string, req.user!);
  ok(res, result);
};

/** POST /api/articles/:id/favorite（登录，收藏/取消） */
export const favoriteHandler: RequestHandler = async (req, res) => {
  const result = await toggleArticleFavorite(req.params.id as string, req.user!);
  ok(res, result);
};

/** POST /api/articles（JWT） */
export const createHandler: RequestHandler = async (req, res) => {
  const article = await createArticle(req.body as CreateArticleInput, req.user!);
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
