import { randomBytes } from 'node:crypto';

import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';

import { sequelize } from '../db/sequelize.js';

/**
 * 私信消息模型（messages 表）
 *
 * - senderKey：发送者 "role:id"，用于未读计数（当前用户收到的未读 = senderKey ≠ 自己）
 * - read：收件人是否已读；对方离线时消息照常落库（read=false），上线后拉取
 * - 过期清理（原 MongoDB TTL 索引 180 天）：由 index.ts 定时删除替代
 */
class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<string>;
  declare conversationId: string;
  declare senderType: 'user' | 'admin';
  declare senderId: string;
  declare senderKey: string;
  declare senderName: string;
  declare content: string;
  declare read: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Message.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    conversationId: { type: DataTypes.STRING(24), allowNull: false },
    senderType: { type: DataTypes.ENUM('user', 'admin'), allowNull: false },
    senderId: { type: DataTypes.STRING(24), allowNull: false },
    senderKey: { type: DataTypes.STRING(255), allowNull: false },
    senderName: { type: DataTypes.STRING(32), allowNull: false, validate: { notEmpty: true } },
    content: { type: DataTypes.STRING(1000), allowNull: false, validate: { notEmpty: true } },
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    indexes: [
      // 会话内按时间拉取消息
      { fields: ['conversationId', 'createdAt'] },
      // 未读计数：会话 + 收件人视角（senderKey ≠ 自己 且 read=false）
      { fields: ['conversationId', 'senderKey', 'read'] },
      // 过期清理按 createdAt 删除
      { fields: ['createdAt'] },
    ],
  },
);

export default Message;
