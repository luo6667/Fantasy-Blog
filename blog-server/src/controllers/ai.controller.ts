import type { RequestHandler } from 'express';

import { chatStream, getSettings, saveSettings, type AiChatMessage } from '../services/ai.service.js';
import { ok } from '../utils/response.js';

/**
 * AI 控制器
 *
 * GET  /api/ai/settings  读取配置（不含 apiKey 明文，管理员）
 * PUT  /api/ai/settings  保存配置（apiKey 留空=保留旧值，管理员）
 * POST /api/ai/chat      流式对话（登录，SSE）
 */

/** 读取 AI 配置（仅返回 hasKey，不回传明文） */
export const getSettingsHandler: RequestHandler = async (_req, res) => {
  const settings = await getSettings();
  ok(res, settings);
};

/** 保存 AI 配置（管理员） */
export const saveSettingsHandler: RequestHandler = async (req, res) => {
  const { baseURL, apiKey, model } = req.body as {
    baseURL?: string;
    apiKey?: string;
    model?: string;
  };
  const settings = await saveSettings({ baseURL, apiKey, model });
  ok(res, settings, 'AI 设置已保存');
};

/** 流式对话（登录用户可用；详情页智能助手使用） */
export const chatHandler: RequestHandler = async (req, res) => {
  const { messages } = req.body as { messages: AiChatMessage[] };
  await chatStream(res, messages);
};
