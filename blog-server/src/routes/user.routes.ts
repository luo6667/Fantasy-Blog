import { Router } from 'express';

import { deleteUserHandler, listUsersHandler } from '../controllers/user.controller.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * 用户路由
 *
 * GET    /api/users/manage   用户列表 + 统计（管理员）
 * DELETE /api/users/:id      删除用户及级联数据（管理员）
 */
router.get('/manage', requireAdmin, listUsersHandler);
router.delete('/:id', requireAdmin, deleteUserHandler);

export default router;
