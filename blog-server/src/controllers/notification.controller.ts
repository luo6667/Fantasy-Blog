import type { RequestHandler } from 'express';

import {
  listNotifications,
  markNotificationsRead,
  unreadNotificationCount,
} from '../services/notification.service.js';
import { ok } from '../utils/response.js';

/**
 * 通知控制器（均需登录）
 *
 * GET  /api/notifications               列表（倒序）
 * GET  /api/notifications/unread-count  未读数
 * POST /api/notifications/read          标记已读（body.ids 可选，缺省全部）
 */

export const listHandler: RequestHandler = async (req, res) => {
  ok(res, await listNotifications(req.user!));
};

export const unreadCountHandler: RequestHandler = async (req, res) => {
  ok(res, await unreadNotificationCount(req.user!));
};

export const markReadHandler: RequestHandler = async (req, res) => {
  const ids = (req.body as { ids?: unknown }).ids;
  const idList = Array.isArray(ids)
    ? ids.filter((x): x is string => typeof x === 'string')
    : undefined;
  ok(res, await markNotificationsRead(req.user!, idList));
};
