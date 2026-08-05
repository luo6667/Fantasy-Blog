import { Router } from 'express';

import { searchUsersHandler } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * 用户路由（登录）
 *
 * GET /api/users?search= 搜索可聊天的对方
 */
router.get('/', requireAuth, searchUsersHandler);

export default router;
