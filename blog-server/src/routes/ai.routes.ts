import { Router } from 'express';
import { z } from 'zod';

import { chatHandler, getSettingsHandler, saveSettingsHandler } from '../controllers/ai.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

/** 保存配置请求体（apiKey 留空 = 保留旧值，避免回显明文） */
const saveSettingsSchema = z.object({
  baseURL: z.string().trim().min(1, '接口地址不能为空').max(500, '接口地址过长'),
  apiKey: z.string().max(500, '密钥过长').optional(),
  model: z.string().trim().min(1, '模型名不能为空').max(100, '模型名过长'),
});

/** 对话请求体（OpenAI 兼容消息数组） */
const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1, '消息内容不能为空').max(50000, '单条消息过长'),
      }),
    )
    .min(1, '消息不能为空')
    .max(50, '消息条数过多'),
});

/**
 * AI 路由
 *
 * GET  /api/ai/settings  读取配置（管理员，不含 apiKey 明文）
 * PUT  /api/ai/settings  保存配置（管理员）
 * POST /api/ai/chat      流式对话（登录，SSE）
 */
router.get('/settings', requireAdmin, getSettingsHandler);
router.put('/settings', requireAdmin, validateBody(saveSettingsSchema), saveSettingsHandler);
router.post('/chat', requireAuth, validateBody(chatSchema), chatHandler);

export default router;
