import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 私信会话模型
 *
 * - participants：恰好两个 "role:id" 字符串（排序后存储，配合唯一索引保证一对一唯一）
 * - lastMessage / lastMessageAt：会话列表排序与预览
 */
export interface ConversationDoc {
  _id: Types.ObjectId;
  participants: string[];
  lastMessage?: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationModel = Model<ConversationDoc>;

const conversationSchema = new Schema<ConversationDoc, ConversationModel>(
  {
    participants: { type: [String], required: true, validate: [(v: string[]) => v.length === 2, '会话必须恰好两名参与者'] },
    lastMessage: { type: String, default: undefined, maxlength: 1000 },
    lastMessageAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

// 参与者排序后建唯一索引，避免 A-B 与 B-A 重复创建
conversationSchema.index({ participants: 1 }, { unique: true });

export const Conversation = model<ConversationDoc, ConversationModel>(
  'Conversation',
  conversationSchema,
);
