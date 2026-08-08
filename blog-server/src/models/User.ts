import bcrypt from 'bcryptjs';
import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 普通用户模型
 *
 * - username 唯一索引，用于登录与评论署名
 * - password 使用 bcrypt 哈希存储，查询默认不返回（select: false）
 * - 保存前自动哈希，提供 comparePassword 实例方法做密码比对
 *
 * 与 Admin（管理员）分开存储，通过 JWT 中的 role 区分身份。
 */

/** User 文档字段 */
export interface UserDoc {
  _id: Types.ObjectId;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

/** User 实例方法 */
export interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserModel = Model<UserDoc, {}, UserMethods>;

const userSchema = new Schema<UserDoc, UserModel, UserMethods>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 32,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

// 管理员列表按注册时间倒序排序（listUsersForAdmin）
userSchema.index({ createdAt: -1 });

/** 密码变更时自动哈希（bcrypt cost = 10） */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

/** 密码比对 */
userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<UserDoc, UserModel>('User', userSchema);
