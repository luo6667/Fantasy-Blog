import type { Response } from 'express';

import { HttpError } from '../middleware/error.js';
import AiConfig from '../models/AiConfig.js';

/**
 * AI 业务逻辑
 *
 * getSettings：读取配置（不含 apiKey 明文，只返回是否已配置）
 * saveSettings：保存/覆盖配置（apiKey 留空表示保留旧值）
 * chatStream：把对话流式转发给 OpenAI 兼容接口（SSE 透传）
 */

/** AI 对话消息 */
export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 对外暴露的配置视图（不含 apiKey 明文） */
export interface AiSettingsView {
  baseURL: string;
  model: string;
  hasKey: boolean;
}

export async function getSettings(): Promise<AiSettingsView> {
  // 显式 include apiKey 才能在内部判断是否已配置；返回值不包含 apiKey 明文
  const cfg = await AiConfig.findOne({ attributes: { include: ['apiKey'] } });
  if (!cfg) {
    return { baseURL: '', model: '', hasKey: false };
  }
  return { baseURL: cfg.baseURL, model: cfg.modelName, hasKey: Boolean(cfg.apiKey) };
}

/** 保存配置；apiKey 传入空串/缺省表示保留旧值 */
export async function saveSettings(input: {
  baseURL?: string;
  apiKey?: string;
  model?: string;
}): Promise<AiSettingsView> {
  let cfg = await AiConfig.findOne();
  if (!cfg) {
    cfg = await AiConfig.create({
      baseURL: input.baseURL ?? '',
      apiKey: input.apiKey ?? '',
      modelName: input.model ?? '',
    });
  }
  if (input.baseURL !== undefined) cfg.baseURL = input.baseURL.trim();
  if (input.model !== undefined) cfg.modelName = input.model.trim();
  if (input.apiKey !== undefined && input.apiKey.trim() !== '') {
    cfg.apiKey = input.apiKey.trim();
  }
  await cfg.save();
  return getSettings();
}

/** 规范化接口地址：接受 "https://api.openai.com/v1" 或 "https://api.deepseek.com" */
function normalizeBaseURL(base: string): string {
  const b = base.trim().replace(/\/+$/, '');
  if (b.endsWith('/chat/completions')) return b;
  if (b.endsWith('/v1')) return `${b}/chat/completions`;
  return `${b}/chat/completions`;
}

/**
 * 流式对话（SSE 透传 OpenAI 兼容 chat/completions）
 *
 * - 读取数据库中的 apiKey 请求上游，不向客户端暴露
 * - 将上游的 SSE data 行原样转发给前端（保持 OpenAI 格式，含 [DONE]）
 * - 配置缺失 / 上游错误时在写响应头前抛 HttpError（由全局错误中间件返回 JSON）
 */
export async function chatStream(
  res: Response,
  messages: AiChatMessage[],
): Promise<void> {
  const cfg = await AiConfig.findOne({ attributes: { include: ['apiKey'] } });
  if (!cfg || !cfg.apiKey) {
    throw new HttpError(400, '请先在管理后台「AI 设置」中配置接口地址与密钥');
  }

  const upstream = await fetch(`${normalizeBaseURL(cfg.baseURL)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.modelName,
      messages,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    throw new HttpError(502, `上游 AI 服务错误（HTTP ${upstream.status}）：${text.slice(0, 200)}`);
  }

  // SSE 响应头
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // 逐块读取上游 SSE，按行切分并转发 data: 行
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        res.write(`data: ${payload}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    // 客户端中断 / 上游异常：尽力收尾
    try {
      res.end();
    } catch {
      /* ignore */
    }
    throw err;
  }
}
