import type { RequestHandler } from 'express';

import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js';
import type { UserBrief } from '../types/user.js';
import { ok } from '../utils/response.js';

/**
 * 用户搜索控制器（登录）
 *
 * GET /api/users?search= 搜索可聊天的对方（普通用户 + 管理员，排除自己）
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const searchUsersHandler: RequestHandler = async (req, res) => {
  const me = req.user!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  // 空搜索返回全部用户（排除自己），便于「新会话」直接选择
  const rx = search !== '' ? new RegExp(escapeRegex(search), 'i') : null;

  const [admins, users] = await Promise.all([
    Admin.find(rx ? { username: rx } : {})
      .select('username')
      .limit(50)
      .lean(),
    User.find(rx ? { username: rx } : {})
      .select('username')
      .limit(200)
      .lean(),
  ]);

  const list: UserBrief[] = [
    ...admins.map((d) => ({ id: d._id.toString(), username: d.username, role: 'admin' as const })),
    ...users.map((d) => ({ id: d._id.toString(), username: d.username, role: 'user' as const })),
  ].filter((u) => !(u.role === me.role && u.id === me.id));

  ok(res, list);
};
