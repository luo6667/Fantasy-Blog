import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SyntheticEvent, useState } from 'react';

import { aiApi } from '@/lib/api';

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-accent';

/**
 * AI 设置（管理后台）
 *
 * 录入 OpenAI 兼容接口（baseURL / apiKey / model）：
 * - apiKey 只写不读：保存后无法回显明文（后端 select:false），留空表示保留旧值
 * - 密钥存储在服务端数据库，前端与部署仓库均不包含密钥，避免泄露
 */
export default function AiSettings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai', 'settings'],
    queryFn: aiApi.getSettings,
  });
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [msg, setMsg] = useState('');

  // 配置加载后回填（仅一次）
  if (settings && !initialized) {
    setBaseURL(settings.baseURL);
    setModel(settings.model);
    setInitialized(true);
  }

  const save = useMutation({
    mutationFn: (input: { baseURL: string; apiKey?: string; model: string }) =>
      aiApi.saveSettings(input),
    onSuccess: () => {
      setApiKey('');
      setMsg('✅ AI 设置已保存');
      void queryClient.invalidateQueries({ queryKey: ['ai', 'settings'] });
    },
    onError: (err: Error) => {
      setMsg(`❌ 保存失败：${err.message}`);
    },
  });

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg('');
    save.mutate({ baseURL: baseURL.trim(), apiKey: apiKey || undefined, model: model.trim() });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.05em] text-text-muted">
        AI 设置
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        配置文章详情页「AI 一键总结 / 智能问答」所用的对话模型，支持任意 OpenAI
        兼容接口（OpenAI / DeepSeek / Kimi / 通义千问等）。
        密钥仅保存在服务端数据库，不会回显到页面，也不会随前端代码泄露。
      </p>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-text-muted">加载中…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-muted">
              接口地址 <span className="text-red-500">*</span>
              <span className="ml-1 text-xs">（例：https://api.openai.com/v1 或 https://api.deepseek.com）</span>
            </span>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => { setBaseURL(e.target.value); }}
              placeholder="https://api.deepseek.com"
              className={inputClass}
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-muted">
              模型名 <span className="text-red-500">*</span>
              <span className="ml-1 text-xs">（例：deepseek-chat、gpt-4o-mini）</span>
            </span>
            <input
              type="text"
              value={model}
              onChange={(e) => { setModel(e.target.value); }}
              placeholder="deepseek-chat"
              className={inputClass}
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-muted">
              API Key
              {settings?.hasKey ? (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                  已配置（留空保存则保持不变）
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-500">
                  未配置，AI 功能不可用
                </span>
              )}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); }}
              placeholder={settings?.hasKey ? '输入新密钥可覆盖，留空保留当前' : 'sk-...'}
              className={inputClass}
              autoComplete="off"
            />
          </label>

          {msg && <p className="text-sm text-accent">{msg}</p>}

          <div>
            <button
              type="submit"
              disabled={save.isPending}
              className="cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? '保存中…' : '保存 AI 设置'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
