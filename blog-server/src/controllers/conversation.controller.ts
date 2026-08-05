import type { RequestHandler } from 'express';

import { HttpError } from '../middleware/error.js';
import {
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from '../services/conversation.service.js';
import { ok } from '../utils/response.js';

/**
 * 会话 / 消息控制器（均需登录）
 *
 * GET    /api/conversations              会话列表（含未读数、在线状态）
 * GET    /api/conversations/:id/messages 历史消息（升序）
 * POST   /api/conversations/:id/read     标记该会话中我收到的消息为已读
 * POST   /api/messages                   发送私信（对方离线则落库为未读）
 */

export const listConversationsHandler: RequestHandler = async (req, res) => {
  ok(res, await listConversations(req.user!));
};

export const listMessagesHandler: RequestHandler = async (req, res) => {
  ok(res, await listMessages(req.params.id as string, req.user!));
};

export const markConversationReadHandler: RequestHandler = async (req, res) => {
  ok(res, await markConversationRead(req.params.id as string, req.user!));
};

export const sendMessageHandler: RequestHandler = async (req, res) => {
  const body = req.body as { recipientType?: unknown; recipientId?: unknown; content?: unknown };
  if (body.recipientType !== 'user' && body.recipientType !== 'admin') {
    throw new HttpError(400, 'recipientType 无效');
  }
  if (typeof body.recipientId !== 'string' || body.recipientId === '') {
    throw new HttpError(400, 'recipientId 无效');
  }
  if (typeof body.content !== 'string' || body.content.trim() === '') {
    throw new HttpError(400, '消息内容不能为空');
  }
  const msg = await sendMessage(
    req.user!,
    { role: body.recipientType, id: body.recipientId },
    body.content.trim(),
  );
  ok(res, msg, '发送成功', 201);
};
