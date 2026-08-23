import type { Response } from 'express';

import type { AuthUser } from './types/auth.js';

/**
 * SSE 实时推送服务（替代 Socket.IO）
 *
 * - GET /api/events（JWT 鉴权，token 走 query 参数）建立 SSE 长连接，按用户维度注册
 * - pushToUser：向指定用户的所有活跃连接推送事件（私信 / 通知 / typing）
 * - isUserOnline：有活跃连接即视为在线
 *
 * 与 Socket.IO 的差异：
 * - SSE 单向（服务端 → 客户端）；客户端上报（typing）改走 REST POST /api/typing
 * - EventSource 原生支持断线自动重连（不需要客户端重连逻辑）
 */

/** 连接注册表：userKey（user:<role>:<id>）-> 活跃的 SSE 响应 */
const connections = new Map<string, Set<Response>>();

/** 用户维度 key（与 Socket.IO 时代一致，避免改调用方） */
export function userRoom(user: Pick<AuthUser, 'role' | 'id'>): string {
  return `user:${user.role}:${user.id}`;
}

/** 注册 SSE 连接 */
export function addConnection(user: Pick<AuthUser, 'role' | 'id'>, res: Response): void {
  const key = userRoom(user);
  const set = connections.get(key) ?? new Set<Response>();
  set.add(res);
  connections.set(key, set);
}

/** 移除 SSE 连接（连接关闭时调用） */
export function removeConnection(user: Pick<AuthUser, 'role' | 'id'>, res: Response): void {
  const key = userRoom(user);
  const set = connections.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(key);
}

/** 向指定用户推送事件（写 SSE 帧，event + data） */
export function pushToUser(
  user: Pick<AuthUser, 'role' | 'id'>,
  event: string,
  data: unknown,
): void {
  const set = connections.get(userRoom(user));
  if (!set || set.size === 0) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(frame);
    } catch {
      /* 连接已断开，等待 close 事件清理 */
    }
  }
}

/** 用户是否有活跃连接（在线状态） */
export function isUserOnline(user: Pick<AuthUser, 'role' | 'id'>): boolean {
  return (connections.get(userRoom(user))?.size ?? 0) > 0;
}
