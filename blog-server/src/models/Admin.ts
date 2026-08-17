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
 * 管理员模型（admins 表）
 *
 * - username 唯一索引，用于登录
 * - password 使用 bcrypt 哈希存储，defaultScope 默认不返回（查询时显式 include）
 * - 保存前自动哈希（仅密码变更时），提供 comparePassword 实例方法做密码比对
 */
class Admin extends Model<InferAttributes<Admin>, InferCreationAttributes<Admin>> {
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

Admin.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      // 24 位 hex 字符串主键（与旧 MongoDB ObjectId 格式一致，迁移时直接沿用旧 _id）
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    username: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      validate: { len: [3, 32] },
    },
    password: { type: DataTypes.STRING(255), allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Admin',
    tableName: 'admins',
    // 默认查询不返回 password，只有显式 attributes.include 才可取回（等价原 select: false）
    defaultScope: { attributes: { exclude: ['password'] } },
    hooks: {
      /** 密码变更时自动哈希（bcrypt cost = 10） */
      async beforeSave(admin) {
        if (admin.changed('password')) {
          admin.password = await bcrypt.hash(admin.password, 10);
        }
      },
    },
  },
);

export default Admin;
