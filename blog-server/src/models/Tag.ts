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
 * 标签模型（tags 表，分类标签库）
 *
 * - name 唯一索引，作为分类标签的权威来源
 * - 文章创建/更新时从标签库中选择，管理员可增删
 * - 删除标签时同时从所有文章移除该标签（见 tag.service）
 */
class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Tag.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    name: { type: DataTypes.STRING(32), allowNull: false, unique: true, validate: { notEmpty: true } },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Tag',
    tableName: 'tags',
  },
);

export default Tag;
