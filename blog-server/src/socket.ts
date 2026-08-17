import type { Server as HttpServer } from 'node:http';

import { Server as SocketServer } from 'socket.io';

import { env } from './config/env.js';
import Conversation from './models/Conversation.js';
import { verifyToken } from './services/auth.service.js';
import type { AuthUser } from './types/auth.js';

/**
 * Socket.IO 服务
 *
 * - 连接鉴权：握手时校验 JWT（client 通过 auth.token 传入）
 * - 每个用户加入自己的房间 user:<role>:<id>，用于定向推送
 * - typing 事件转发：客户端上报「正在输入」，服务端转发给会话对方
 *
 * 私信消息本身走 REST（保证落库不丢），Socket 只负责实时推送与在线状态。
 */

let io: SocketServer | null = null;

/** 用户维度房间名：user:<role>:<id> */
export function userRoom(user: Pick<AuthUser, 'role' | 'id'>): string {
  return `user:${user.role}:${user.id}`;
}

/** 初始化 Socket.IO（挂到 HTTP server 上） */
export function initSocket(server: HttpServer): SocketServer {
  const srv = new SocketServer(server, {
    cors: { origin: env.CORS_ORIGIN.split(','), credentials: true },
  });

  // 连接鉴权
  srv.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth as { token?: unknown } | undefined;
      const token = typeof auth?.token === 'string' ? auth.token : undefined;
      if (!token) throw new Error('missing token');
      const user = await verifyToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  srv.on('connection', (socket) => {
    const user = socket.data.user as AuthUser;
    socket.join(userRoom(user));

    // 「正在输入」转发给会话对方（校验双方确实存在会话，避免向任意房间灌事件）
    socket.on(
      'typing',
      async (data: {
        recipientType: 'user' | 'admin';
        recipientId: string;
        conversationId: string;
        isTyping: boolean;
      }) => {
        const participantsKey = [`${user.role}:${user.id}`, `${data.recipientType}:${data.recipientId}`]
          .sort()
          .join('|');
        const conv = await Conversation.findOne({ where: { participantsKey }, attributes: ['id'] });
        if (!conv) return;
        socket.to(userRoom({ role: data.recipientType, id: data.recipientId })).emit('typing', {
          conversationId: data.conversationId,
          sender: { id: user.id, username: user.username, role: user.role },
          isTyping: data.isTyping,
        });
      },
    );
  });

  io = srv;
  return srv;
}

/** 获取 Socket.IO 实例（服务启动后可调用；未初始化时为 null） */
export function getIO(): SocketServer | null {
  return io;
}

/** 对方是否在线（有活跃连接） */
export function isUserOnline(user: Pick<AuthUser, 'role' | 'id'>): boolean {
  if (!io) return false;
  return (io.sockets.adapter.rooms.get(userRoom(user))?.size ?? 0) > 0;
}
