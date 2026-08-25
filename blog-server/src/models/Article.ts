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
 * 文章模型（articles 表）
 *
 * - title/excerpt/content 为必填（content 供详情页渲染正文）
 * - tags 字符串数组，用于列表页标签筛选（MySQL JSON 列存储）
 * - cover 封面图 URL（可选，配合 /api/upload 使用）
 * - author* 文章作者（创建时记录；旧数据可能为空）
 * - likedBy / favoritedBy 点赞者、收藏者标识数组（"role:id"），用于去重与计数（JSON 列）
 * - timestamps 自动维护 createdAt / updatedAt
 */

/** 作者类型 */
export type ArticleAuthorType = 'user' | 'admin';

/**
 * Sequelize ORM 模型 = 数据表结构的 TypeScript 映射:
 * 类属性(declare)即列定义,Article.init 声明列类型/约束/索引;
 * InferAttributes / InferCreationAttributes 让读写字段获得完整类型推导。
 */
class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare excerpt: string;
  declare content: string;
  /** 服务端编译并消毒后的正文 HTML（渲染端直接展示，不执行 JSX） */
  declare contentHtml: CreationOptional<string>;
  declare tags: CreationOptional<string[]>;
  declare cover: CreationOptional<string>;
  declare authorType: ArticleAuthorType | null;
  declare authorId: string | null;
  declare authorName: string | null;
  declare likedBy: CreationOptional<string[]>;
  declare favoritedBy: CreationOptional<string[]>;
  /** 点赞数（冗余计数，由 toggle 接口事务维护，避免读大数组算 length） */
  declare likes: CreationOptional<number>;
  /** 收藏数（冗余计数） */
  declare favorites: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Article.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    title: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: true } },
    excerpt: { type: DataTypes.STRING(500), allowNull: false, validate: { notEmpty: true } },
    content: { type: DataTypes.TEXT('medium'), allowNull: false },
    // 注：TEXT/JSON 列在 MySQL 中不能声明 DEFAULT，默认值由业务层创建时显式提供
    contentHtml: { type: DataTypes.TEXT('medium'), allowNull: false },
    tags: { type: DataTypes.JSON, allowNull: false },
    cover: { type: DataTypes.STRING(2048), allowNull: false, defaultValue: '' },
    authorType: { type: DataTypes.ENUM('user', 'admin'), allowNull: true },
    authorId: { type: DataTypes.STRING(24), allowNull: true },
    authorName: { type: DataTypes.STRING(32), allowNull: true },
    likedBy: { type: DataTypes.JSON, allowNull: false },
    favoritedBy: { type: DataTypes.JSON, allowNull: false },
    // 冗余计数：点赞/收藏接口在事务中原子维护；列表页不再读取大数组
    likes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    favorites: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Article',
    tableName: 'articles',
    // 列表按发布时间倒序查询走索引。
    // 注：tags / favoritedBy 为 JSON 列，MySQL 不支持直接建普通索引（个人站点数据量小，查询仍正确）
    indexes: [{ fields: ['createdAt'] }],
  },
);

export default Article;
