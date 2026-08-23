import { Router } from 'express';
import { z } from 'zod';

import Conversation from '../models/Conversation.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { verifyToken } from '../services/auth.service.js';
import { addConnection, pushToUser, removeConnection } from '../sse.js';
import type { AuthUser } from '../types/auth.js';
import { fail } from '../utils/response.js';

const router = Router();

/** typing 上报请求体（与 Socket.IO 时代的 typing 事件 payload 一致） */
const typingSchema = z.object({
  recipientType: z.enum(['user', 'admin']),
  recipientId: z.string().min(1, 'recipientId 不能为空'),
  conversationId: z.string().min(1, 'conversationId 不能为空'),
  isTyping: z.boolean(),
});

/** 会话唯一键：两名参与者（role:id）排序后以 | 连接（与 conversation.service 一致） */
function participantsKeyOf(a: { role: string; id: string }, b: { role: string; id: string }): string {
  return [`${a.role}:${a.id}`, `${b.role}:${b.id}`].sort().join('|');
}

/**
 * SSE 长连接：GET /api/events?token=xxx
 *
 * EventSource 无法自定义请求头，JWT 通过 query 参数传入。
 * 建立连接后注册到推送表，心跳保活；连接关闭时自动清理。
 */
router.get('/events', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (!token) {
    fail(res, '请先登录', 401);
    return;
  }
  let user: AuthUser;
  try {
    user = await verifyToken(token);
  } catch {
    fail(res, '登录已过期，请重新登录', 401);
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 关闭 Nginx 缓冲，保证事件实时到达
  res.flushHeaders?.();

  addConnection(user, res);
  // 立即写初始帧：让代理（Next rewrites / Nginx）立刻转发响应头，客户端 EventSource 随即触发 open
  res.write(': connected\n\n');
  // 心跳：防止代理 / 浏览器把空闲连接断开
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* 连接已断开 */
    }
  }, 25_000);

  // 注意：用 res.on('close') 而非 req.on('close')——Node 中 req 的 close 在请求体读完（GET 无 body）即触发，
  // 会把刚注册的 SSE 连接立刻清理；res 的 close 才表示响应/连接真正关闭。
  res.on('close', () => {
    clearInterval(heartbeat);
    removeConnection(user, res);
  });
});

/**
 * typing 上报：POST /api/typing
 *
 * SSE 是单向通道，客户端「正在输入」状态通过 REST 上报，
 * 服务端校验双方存在会话后转发给对方（防止向任意房间灌事件）。
 */
router.post(
  '/typing',
  writeLimiter,
  requireAuth,
  validateBody(typingSchema),
  async (req, res) => {
    const { recipientType, recipientId, conversationId, isTyping } = req.body;
    const sender = req.user as AuthUser;

    const participantsKey = participantsKeyOf(
      { role: sender.role, id: sender.id },
      { role: recipientType, id: recipientId },
    );
    const conv = await Conversation.findOne({ where: { participantsKey }, attributes: ['id'] });
    if (!conv) {
      fail(res, '会话不存在', 404);
      return;
    }

    pushToUser({ role: recipientType, id: recipientId }, 'typing', {
      conversationId,
      sender: { id: sender.id, username: sender.username, role: sender.role },
      isTyping,
    });
    res.json({ ok: true });
  },
);

export default router;
