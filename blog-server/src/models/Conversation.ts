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
 * 私信会话模型（conversations 表）
 *
 * - participants：恰好两个 "role:id" 字符串（排序后存储，JSON 列）
 * - participantsKey：参与者排序后以 "|" 连接的规范化键，唯一索引建在此字符串字段上。
 *   （MySQL 下仍以字符串唯一索引保证一对一唯一，避免对数组字段建唯一索引的歧义）
 * - lastMessage / lastMessageAt：会话列表排序与预览
 */
class Conversation extends Model<InferAttributes<Conversation>, InferCreationAttributes<Conversation>> {
  declare id: CreationOptional<string>;
  declare participants: string[];
  declare participantsKey: string;
  declare lastMessage: string | null;
  declare lastMessageAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Conversation.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    participants: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        /** 会话必须恰好两名参与者 */
        isTwoParticipants(value: string[]) {
          if (!Array.isArray(value) || value.length !== 2) {
            throw new Error('会话必须恰好两名参与者');
          }
        },
      },
    },
    // 规范化唯一键：["user:A","user:B"] -> "user:A|user:B"
    participantsKey: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    lastMessage: { type: DataTypes.STRING(1000), allowNull: true },
    lastMessageAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Conversation',
    tableName: 'conversations',
    // participants 仅作普通查询（JSON_CONTAINS）；唯一性由 participantsKey 保证
  },
);

export default Conversation;
