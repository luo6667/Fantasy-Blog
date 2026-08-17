import { randomBytes } from 'node:crypto';

import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';

import { sequelize } from '../db/sequelize.js';

import type { NotificationType } from '../types/notification.js';

/**
 * 通知模型（notifications 表）
 *
 * 由评论文章、回复评论、收藏文章等行为自动生成：
 * - recipient：接收者（普通用户或管理员）
 * - actor：触发者
 * - read 标记是否已读；列表按时间倒序
 */
class Notification extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> {
  declare id: CreationOptional<string>;
  declare recipientType: 'user' | 'admin';
  declare recipientId: string;
  declare type: NotificationType;
  declare actorType: 'user' | 'admin';
  declare actorId: string;
  declare actorName: string;
  declare articleId: string | null;
  declare articleTitle: string | null;
  declare commentId: string | null;
  declare commentContent: string | null;
  declare read: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Notification.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    recipientType: { type: DataTypes.ENUM('user', 'admin'), allowNull: false },
    recipientId: { type: DataTypes.STRING(24), allowNull: false },
    type: {
      type: DataTypes.ENUM('comment', 'reply', 'like', 'favorite', 'article'),
      allowNull: false,
    },
    actorType: { type: DataTypes.ENUM('user', 'admin'), allowNull: false },
    actorId: { type: DataTypes.STRING(24), allowNull: false },
    actorName: { type: DataTypes.STRING(32), allowNull: false, validate: { notEmpty: true } },
    articleId: { type: DataTypes.STRING(24), allowNull: true },
    articleTitle: { type: DataTypes.STRING(200), allowNull: true },
    commentId: { type: DataTypes.STRING(24), allowNull: true },
    commentContent: { type: DataTypes.STRING(1000), allowNull: true },
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    indexes: [
      // 按接收者拉取通知 + 未读计数走索引
      { fields: ['recipientType', 'recipientId', 'createdAt'] },
      { fields: ['recipientType', 'recipientId', 'read'] },
      // 删除用户时按触发者级联清理通知
      { fields: ['actorType', 'actorId'] },
    ],
  },
);

export default Notification;
