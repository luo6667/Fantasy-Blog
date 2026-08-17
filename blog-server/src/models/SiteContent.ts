import { randomBytes } from 'node:crypto';

import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';

import { sequelize } from '../db/sequelize.js';

import type { SiteContentKey, SiteContentValue } from '../types/siteContent.js';

/**
 * 站点内容模型（site_contents 表，简历页 / 首页展示内容的持久化）
 *
 * - key 唯一索引，一 key 一条记录
 * - value 以 JSON 列存储各内容的 JSON（教育背景 / 专业技能 / 项目经历 / 个人评价 / 精选项目）
 * - 由 service 在启动时 seed 默认值，管理员通过 /api/site-content 增删改
 */
class SiteContent extends Model<InferAttributes<SiteContent>, InferCreationAttributes<SiteContent>> {
  declare id: CreationOptional<string>;
  declare key: SiteContentKey;
  declare value: SiteContentValue;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

SiteContent.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    key: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    value: { type: DataTypes.JSON, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'SiteContent',
    tableName: 'site_contents',
  },
);

export default SiteContent;
