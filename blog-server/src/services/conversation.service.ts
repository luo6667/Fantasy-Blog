import { Admin } from '../models/Admin.js';
import { Conversation } from '../models/Conversation.js';
import { Message, type MessageDoc } from '../models/Message.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/error.js';
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

function splitKey(key: string): { role: 'user' | 'admin'; id: string } {
  const [role, id] = key.split(':');
  return { role: role === 'admin' ? 'admin' : 'user', id: id ?? '' };
}

/** 根据标识查询对方（普通用户或管理员） */
async function findPeer(key: string): Promise<ChatPeer | null> {
  const { role, id } = splitKey(key);
  if (role === 'admin') {
    const doc = await Admin.findById(id).lean();
    return doc ? { id: doc._id.toString(), username: doc.username, role: 'admin' } : null;
  }
  const doc = await User.findById(id).lean();
  return doc ? { id: doc._id.toString(), username: doc.username, role: 'user' } : null;
}

/** 获取或创建两名参与者之间的会话（参与者排序后唯一） */
async function getOrCreateConversation(
  a: Pick<AuthUser, 'role' | 'id'>,
  b: Pick<AuthUser, 'role' | 'id'>,
) {
  const participants = [participantKey(a), participantKey(b)].sort();
  const existing = await Conversation.findOne({ participants });
  if (existing) return existing;
  return Conversation.create({ participants });
}

function toMessage(doc: MessageDoc, meKey: string): MessageItem {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversation.toString(),
    sender: { id: doc.senderId.toString(), username: doc.senderName, role: doc.senderType },
    content: doc.content,
    mine: doc.senderKey === meKey,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** 当前用户的会话列表（含对方信息、未读数、在线状态） */
export async function listConversations(user: AuthUser): Promise<ConversationItem[]> {
  const meKey = participantKey(user);
  const convs = await Conversation.find({ participants: meKey })
    .sort({ lastMessageAt: -1 })
    .lean();

  return Promise.all(
    convs.map(async (c) => {
      const otherKey = c.participants.find((p) => p !== meKey);
      const peer = otherKey ? await findPeer(otherKey) : null;
      const unread = await Message.countDocuments({
        conversation: c._id,
        read: false,
        senderKey: { $ne: meKey },
      });
      return {
        id: c._id.toString(),
        peer: peer ?? { id: '', username: '未知用户', role: 'user' as const },
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt.toISOString(),
        unread,
        isOnline: peer !== null && isUserOnline(peer),
      };
    }),
  );
}

/** 会话历史消息（倒序取最新 200 条再升序返回） */
export async function listMessages(
  conversationId: string,
  user: AuthUser,
): Promise<MessageItem[]> {
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.participants.includes(participantKey(user))) {
    throw new HttpError(404, '会话不存在');
  }
  const docs = await Message.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
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
    conversation: conv._id,
    senderType: sender.role,
    senderId: sender.id,
    senderKey: participantKey(sender),
    senderName: sender.username,
    content,
  });
  await Conversation.updateOne(
    { _id: conv._id },
    { lastMessage: content, lastMessageAt: doc.createdAt },
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
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.participants.includes(participantKey(user))) {
    throw new HttpError(404, '会话不存在');
  }
  await Message.updateMany(
    { conversation: conversationId, read: false, senderKey: { $ne: participantKey(user) } },
    { $set: { read: true } },
  );
  return { ok: true };
}
