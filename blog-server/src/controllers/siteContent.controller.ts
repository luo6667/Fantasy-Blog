import type { RequestHandler } from 'express';

import {
  getSiteContent,
  listSiteContents,
  updateSiteContent,
} from '../services/siteContent.service.js';
import type { SiteContentKey, SiteContentValue } from '../types/siteContent.js';
import { ok } from '../utils/response.js';

/**
 * 站点内容控制器
 *
 * 公开读 + 管理员写：
 * - GET  /api/site-content     全部内容（管理员）
 * - GET  /api/site-content/:key 单个内容（公开）
 * - PUT  /api/site-content/:key 更新单个内容（管理员）
 */

/** GET /api/site-content（管理员） */
export const listHandler: RequestHandler = async (_req, res) => {
  const items = await listSiteContents();
  ok(res, items);
};

/** GET /api/site-content/:key（公开） */
export const getHandler: RequestHandler = async (req, res) => {
  const item = await getSiteContent(req.params.key as SiteContentKey);
  ok(res, item);
};

/** PUT /api/site-content/:key（管理员；value 已在路由层按 key 校验） */
export const updateHandler: RequestHandler = async (req, res) => {
  const item = await updateSiteContent(
    req.params.key as SiteContentKey,
    req.body.value as SiteContentValue,
  );
  ok(res, item, 'Content updated');
};
