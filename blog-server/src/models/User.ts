import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';

import { sequelize } from '../db/sequelize.js';

/**
 * 普通用户模型（users 表）
 *
 * - username 唯一索引，用于登录与评论署名
 * - password 使用 bcrypt 哈希存储，defaultScope 默认不返回
 * - 保存前自动哈希，提供 comparePassword 实例方法做密码比对
 *
 * 与 Admin（管理员）分开存储，通过 JWT 中的 role 区分身份。
 */
class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare username: string;
  declare password: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  /** 密码比对 */
  comparePassword(candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    username: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      validate: { len: [2, 32] },
    },
    password: { type: DataTypes.STRING(255), allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    // 管理员列表按注册时间倒序排序（listUsersForAdmin）
    indexes: [{ fields: ['createdAt'] }],
    defaultScope: { attributes: { exclude: ['password'] } },
    hooks: {
      /** 密码变更时自动哈希（bcrypt cost = 10） */
      async beforeSave(user) {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  },
);

export default User;
