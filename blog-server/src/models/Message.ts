import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 私信消息模型
 *
 * - senderKey：发送者 "role:id"，用于未读计数（当前用户收到的未读 = senderKey ≠ 自己）
 * - read：收件人是否已读；对方离线时消息照常落库（read=false），上线后拉取
 */
export interface MessageDoc {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  senderType: 'user' | 'admin';
  senderId: Types.ObjectId;
  senderKey: string;
  senderName: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

export type MessageModel = Model<MessageDoc>;

const messageSchema = new Schema<MessageDoc, MessageModel>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderType: { type: String, enum: ['user', 'admin'], required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderKey: { type: String, required: true },
    senderName: { type: String, required: true, trim: true, maxlength: 32 },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// 会话内按时间拉取消息
messageSchema.index({ conversation: 1, createdAt: 1 });
// 未读计数：会话 + 收件人视角（senderKey ≠ 自己 且 read=false）
messageSchema.index({ conversation: 1, senderKey: 1, read: 1 });

export const Message = model<MessageDoc, MessageModel>('Message', messageSchema);
