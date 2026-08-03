import bcrypt from 'bcryptjs';
import { model, Schema, Types, type Model } from 'mongoose';

/**
 * 管理员模型
 *
 * - username 唯一索引，用于登录
 * - password 使用 bcrypt 哈希存储，查询默认不返回（select: false）
 * - 保存前自动哈希，提供 comparePassword 实例方法做密码比对
 */

/** Admin 文档字段 */
export interface AdminDoc {
  _id: Types.ObjectId;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin 实例方法 */
export interface AdminMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type AdminModel = Model<AdminDoc, {}, AdminMethods>;

const adminSchema = new Schema<AdminDoc, AdminModel, AdminMethods>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
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

/** 密码变更时自动哈希（bcrypt cost = 10） */
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

/** 密码比对 */
adminSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const Admin = model<AdminDoc, AdminModel>('Admin', adminSchema);
