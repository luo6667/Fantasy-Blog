import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 私信会话模型
 *
 * - participants：恰好两个 "role:id" 字符串（排序后存储）
 * - participantsKey：参与者排序后以 "|" 连接的规范化键，唯一索引建在此字符串字段上。
 *   注意：不能把 unique 建在 participants（数组）字段上——MongoDB 多键索引会对数组的
 *   每个元素各建一条索引并全局唯一，导致任何两个共享同一参与者的会话都无法创建。
 * - lastMessage / lastMessageAt：会话列表排序与预览
 */
export interface ConversationDoc {
  _id: Types.ObjectId;
  participants: string[];
  participantsKey: string;
  lastMessage?: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationModel = Model<ConversationDoc>;

const conversationSchema = new Schema<ConversationDoc, ConversationModel>(
  {
    participants: { type: [String], required: true, validate: [(v: string[]) => v.length === 2, '会话必须恰好两名参与者'] },
    // 规范化唯一键：["user:A","user:B"] -> "user:A|user:B"
    participantsKey: { type: String, required: true, unique: true },
    lastMessage: { type: String, default: undefined, maxlength: 1000 },
    lastMessageAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

// participants 仅作普通索引（按参与者查询会话）；唯一性由 participantsKey 保证
conversationSchema.index({ participants: 1 });

export const Conversation = model<ConversationDoc, ConversationModel>(
  'Conversation',
  conversationSchema,
);
