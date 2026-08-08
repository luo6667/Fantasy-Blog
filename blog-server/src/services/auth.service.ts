import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js';
import type { AuthUser, JwtPayload, UserRole } from '../types/auth.js';

/**
 * 认证业务逻辑
 *
 * register：注册普通用户（仅普通用户可注册，管理员账号固定为 admin）
 * loginUser / loginAdmin：分别校验普通用户/管理员密码并签发 JWT（payload 带 role）
 * verifyToken：校验 token 并返回对应用户（旧 token 无 role 时按管理员兼容）
 */

function signToken(id: string, username: string, role: UserRole): string {
  const payload: JwtPayload = { sub: id, username, role };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** 注册普通用户：用户名与管理员/普通用户均冲突时返回 409 */
export async function register(username: string, password: string): Promise<AuthUser> {
  const [adminExists, userExists] = await Promise.all([
    Admin.exists({ username }),
    User.exists({ username }),
  ]);
  if (adminExists || userExists) {
    throw new HttpError(409, '该用户名已被占用');
  }
  const user = await User.create({ username, password });
  return { id: user._id.toString(), username: user.username, role: 'user' };
}

/** 普通用户登录 */
export async function loginUser(
  username: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const user = await User.findOne({ username }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, '用户名或密码错误');
  }
  const authUser: AuthUser = { id: user._id.toString(), username: user.username, role: 'user' };
  return { token: signToken(authUser.id, authUser.username, authUser.role), user: authUser };
}

/** 管理员登录 */
export async function loginAdmin(
  username: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const admin = await Admin.findOne({ username }).select('+password');
  if (!admin || !(await admin.comparePassword(password))) {
    throw new HttpError(401, '管理员账号或密码错误');
  }
  const authUser: AuthUser = { id: admin._id.toString(), username: admin.username, role: 'admin' };
  return { token: signToken(authUser.id, authUser.username, authUser.role), user: authUser };
}

/** 校验 Bearer token，返回对应用户（不存在则 401）；旧 token 无 role 时按管理员兼容 */
export async function verifyToken(token: string): Promise<AuthUser> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new HttpError(401, '登录已过期，请重新登录');
  }

  const id = payload.sub;
  // 旧格式 token 无 role 时直接拒绝（不兑底为管理员），避免被伪造或误判身份
  if (payload.role !== 'admin' && payload.role !== 'user') {
    throw new HttpError(401, '登录已过期，请重新登录');
  }
  const role: UserRole = payload.role;
  if (role === 'admin') {
    const admin = await Admin.findById(id);
    if (!admin) throw new HttpError(401, '管理员不存在');
    return { id: admin._id.toString(), username: admin.username, role: 'admin' };
  }
  const user = await User.findById(id);
  if (!user) throw new HttpError(401, '用户不存在');
  return { id: user._id.toString(), username: user.username, role: 'user' };
}
