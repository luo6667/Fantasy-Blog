import { fn, literal, Op } from 'sequelize';

import { sequelize } from '../db/sequelize.js';
import { HttpError } from '../middleware/error.js';
import Admin from '../models/Admin.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getIO, isUserOnline, userRoom } from '../socket.js';
import type { AuthUser } from '../types/auth.js';
import type { ChatPeer, ConversationItem, MessageItem } from '../types/conversation.js';

/**
 * 私信会话业务逻辑
 *
 * 消息走 REST 落库（对方离线也不丢，read=false 记为未读），
 * 发送成功后通过 Socket.IO 实时推送给在线收件人；
 * 收件人上线时从会话列表拉取未读并标记已读。
 */

/** "role:id" 参与者标识 */
function participantKey(user: Pick<AuthUser, 'role' | 'id'>): string {
  return `${user.role}:${user.id}`;
}

/** 会话规范化唯一键：两名参与者排序后以 "|" 连接 */
function conversationKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function splitKey(key: string): { role: 'user' | 'admin'; id: string } {
  const [role, id] = key.split(':');
  return { role: role === 'admin' ? 'admin' : 'user', id: id ?? '' };
}

/** JSON 数组列包含指定字符串值（等价 MongoDB 的 { participants: key } 数组匹配） */
function jsonContains(column: string, value: string) {
  return literal(`JSON_CONTAINS(${column}, JSON_QUOTE(${sequelize.escape(value)}))`);
}

/** 根据标识查询对方（普通用户或管理员） */
async function findPeer(key: string): Promise<ChatPeer | null> {
  const { role, id } = splitKey(key);
  if (role === 'admin') {
    const doc = await Admin.findByPk(id);
    return doc ? { id: doc.id, username: doc.username, role: 'admin' } : null;
  }
  const doc = await User.findByPk(id);
  return doc ? { id: doc.id, username: doc.username, role: 'user' } : null;
}

/**
 * 获取或创建两名参与者之间的会话
 *
 * 用 participantsKey（字符串唯一索引）保证一对一唯一；并发创建时以
 * 唯一约束冲突兜底重查（等价旧代码 11000 分支）。
 */
async function getOrCreateConversation(
  a: Pick<AuthUser, 'role' | 'id'>,
  b: Pick<AuthUser, 'role' | 'id'>,
) {
  const participants = [participantKey(a), participantKey(b)].sort();
  const participantsKey = conversationKey(participants[0] as string, participants[1] as string);
  const existing = await Conversation.findOne({ where: { participantsKey } });
  if (existing) return existing;
  try {
    return await Conversation.create({ participants, participantsKey });
  } catch (err) {
    // 并发下两个请求同时发现会话不存在 → 双双创建，唯一索引冲突时回退查询
    if (err instanceof Error && err.name === 'SequelizeUniqueConstraintError') {
      const again = await Conversation.findOne({ where: { participantsKey } });
      if (again) return again;
    }
    throw err;
  }
}

function toMessage(doc: Message, meKey: string): MessageItem {
  return {
    id: doc.id,
    conversationId: doc.conversationId,
    sender: { id: doc.senderId, username: doc.senderName, role: doc.senderType },
    content: doc.content,
    mine: doc.senderKey === meKey,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** 当前用户的会话列表（含对方信息、未读数、在线状态） */
export async function listConversations(user: AuthUser): Promise<ConversationItem[]> {
  const meKey = participantKey(user);
  const convs = await Conversation.findAll({
    where: jsonContains('participants', meKey),
    order: [['lastMessageAt', 'DESC']],
  });
  if (convs.length === 0) return [];

  const convIds = convs.map((c) => c.id);

  // 未读数：一次分组查询按会话统计，避免逐会话 count（N+1）
  const unreadRows = (await Message.findAll({
    where: {
      conversationId: { [Op.in]: convIds },
      read: false,
      senderKey: { [Op.ne]: meKey },
    },
    attributes: ['conversationId', [fn('COUNT', '*'), 'count']],
    group: ['conversationId'],
    raw: true,
  })) as unknown as { conversationId: string; count: number }[];
  const unreadMap = new Map(
    unreadRows.map((r) => [String(r.conversationId), Number(r.count)]),
  );

  // 对方信息：按 role 分组各批量查询一次（避免逐会话 findPeer 的 2N 次 DB 往返）
  const otherKeys = convs
    .map((c) => c.participants.find((p) => p !== meKey))
    .filter((k): k is string => Boolean(k));
  const adminIds = otherKeys.filter((k) => k.startsWith('admin:')).map((k) => k.slice('admin:'.length));
  const userIds = otherKeys.filter((k) => k.startsWith('user:')).map((k) => k.slice('user:'.length));
  const [admins, users] = await Promise.all([
    adminIds.length > 0
      ? Admin.findAll({ where: { id: { [Op.in]: adminIds } }, attributes: ['id', 'username'] })
      : Promise.resolve([]),
    userIds.length > 0
      ? User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] })
      : Promise.resolve([]),
  ]);
  const peerMap = new Map<string, ChatPeer>();
  for (const d of admins) {
    peerMap.set(`admin:${d.id}`, { id: d.id, username: d.username, role: 'admin' });
  }
  for (const d of users) {
    peerMap.set(`user:${d.id}`, { id: d.id, username: d.username, role: 'user' });
  }

  return convs.map((c) => {
    const otherKey = c.participants.find((p) => p !== meKey);
    const peer = otherKey ? (peerMap.get(otherKey) ?? null) : null;
    return {
      id: c.id,
      peer: peer ?? { id: '', username: '未知用户', role: 'user' as const },
      lastMessage: c.lastMessage ?? undefined,
      lastMessageAt: c.lastMessageAt.toISOString(),
      unread: unreadMap.get(c.id) ?? 0,
      isOnline: peer !== null && isUserOnline(peer),
    };
  });
}

/** 会话历史消息（倒序取最新 100 条再升序返回） */
export async function listMessages(
  conversationId: string,
  user: AuthUser,
): Promise<MessageItem[]> {
  const conv = await Conversation.findByPk(conversationId);
  if (!conv || !conv.participants.includes(participantKey(user))) {
    throw new HttpError(404, '会话不存在');
  }
  const docs = await Message.findAll({
    where: { conversationId },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  docs.reverse();
  const meKey = participantKey(user);
  return docs.map((d) => toMessage(d, meKey));
}

/** 发送私信（自动创建/复用会话；对方在线则实时推送） */
export async function sendMessage(
  sender: AuthUser,
  recipient: { role: 'user' | 'admin'; id: string },
  content: string,
): Promise<MessageItem> {
  if (sender.role === recipient.role && sender.id === recipient.id) {
    throw new HttpError(400, '不能给自己发送消息');
  }
  const peer = await findPeer(participantKey(recipient));
  if (!peer) {
    throw new HttpError(404, '对方不存在');
  }
  const conv = await getOrCreateConversation(sender, recipient);
  const doc = await Message.create({
    conversationId: conv.id,
    senderType: sender.role,
    senderId: sender.id,
    senderKey: participantKey(sender),
    senderName: sender.username,
    content,
  });
  await Conversation.update(
    { lastMessage: content, lastMessageAt: doc.createdAt },
    { where: { id: conv.id } },
  );
  // 发送方视角（mine=true）返回给 REST 调用方；收件人视角（mine=false）实时推送
  const senderItem = toMessage(doc, participantKey(sender));
  const recipientItem = toMessage(doc, participantKey(recipient));
  getIO()?.to(userRoom(recipient)).emit('message:new', recipientItem);
  return senderItem;
}

/** 标记会话中我收到的消息为已读 */
export async function markConversationRead(
  conversationId: string,
  user: AuthUser,
): Promise<{ ok: boolean }> {
  const conv = await Conversation.findByPk(conversationId);
  if (!conv || !conv.participants.includes(participantKey(user))) {
    throw new HttpError(404, '会话不存在');
  }
  await Message.update(
    { read: true },
    {
      where: {
        conversationId,
        read: false,
        senderKey: { [Op.ne]: participantKey(user) },
      },
    },
  );
  return { ok: true };
}
