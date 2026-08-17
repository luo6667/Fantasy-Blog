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
 * AI 配置模型（ai_configs 表，单例行）
 *
 * 存储管理后台录入的 LLM 接入信息：
 * - baseURL / modelName：OpenAI 兼容接口地址与模型名
 * - apiKey：密钥，defaultScope 默认不返回，仅服务端转发请求时读取，前端永远拿不到明文
 */
class AiConfig extends Model<InferAttributes<AiConfig>, InferCreationAttributes<AiConfig>> {
  declare id: CreationOptional<string>;
  declare baseURL: CreationOptional<string>;
  declare apiKey: CreationOptional<string>;
  declare modelName: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AiConfig.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    baseURL: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
    // defaultScope 排除 apiKey：默认查询不返回，只有显式 attributes.include 才可取回
    // 注：TEXT 列在 MySQL 中不能声明 DEFAULT，创建时由业务层显式提供
    apiKey: { type: DataTypes.TEXT('medium'), allowNull: false },
    modelName: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'AiConfig',
    tableName: 'ai_configs',
    defaultScope: { attributes: { exclude: ['apiKey'] } },
  },
);

export default AiConfig;
