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
 * 评论模型（comments 表）
 *
 * - articleId：所属文章
 * - parentId：父评论（回复时指向一级评论；一级评论为 null）
 * - authorType / authorId / authorName：作者（普通用户或管理员，冗余署名）
 * - likedBy：点赞者标识数组（"user:<id>" / "admin:<id>"），用于去重与取消点赞（JSON 列）
 */

/** 作者类型 */
export type CommentAuthorType = 'user' | 'admin';

class Comment extends Model<InferAttributes<Comment>, InferCreationAttributes<Comment>> {
  declare id: CreationOptional<string>;
  declare articleId: string;
  declare parentId: string | null;
  declare authorType: CommentAuthorType;
  declare authorId: string;
  declare authorName: string;
  declare content: string;
  declare likedBy: CreationOptional<string[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Comment.init(
  {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      defaultValue: () => randomBytes(12).toString('hex'),
    },
    articleId: { type: DataTypes.STRING(24), allowNull: false },
    parentId: { type: DataTypes.STRING(24), allowNull: true },
    authorType: { type: DataTypes.ENUM('user', 'admin'), allowNull: false },
    authorId: { type: DataTypes.STRING(24), allowNull: false },
    authorName: { type: DataTypes.STRING(32), allowNull: false, validate: { notEmpty: true } },
    content: { type: DataTypes.STRING(1000), allowNull: false, validate: { notEmpty: true } },
    // 注：JSON 列在 MySQL 中不能声明 DEFAULT，默认值由业务层创建时显式提供
    likedBy: { type: DataTypes.JSON, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Comment',
    tableName: 'comments',
    indexes: [
      // 按文章拉取评论（含回复）走索引
      { fields: ['articleId', 'createdAt'] },
      // 删除评论时按 parent 清理回复
      { fields: ['parentId'] },
      // 删除用户时按作者级联清理评论
      { fields: ['authorId', 'authorType'] },
    ],
  },
);

export default Comment;
