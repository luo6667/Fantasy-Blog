import { type SyntheticEvent, useState } from 'react';

import { useAiStream } from '@/hooks/useAiStream';
import { useAuth } from '@/hooks/useAuth';
import type { AiChatMessage } from '@/types/api';

/**
 * 文章详情页智能助手（评论区上方）
 *
 * - 「AI 一键总结」：基于文章内容流式生成要点总结
 * - 总结生成后可在下方继续向助手提问（对话式回复，与写文章 AI 共用同一配置）
 */

const SUMMARY_PROMPT = '请用简洁的语言总结这篇文章的核心要点，分点列出（3-6 条），控制在 300 字以内。';

interface UiMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface ArticleAiAssistantProps {
  title: string;
  excerpt: string;
  content: string;
  /** 未登录时点击触发（由父级打开登录弹窗） */
  onRequireLogin: () => void;
}

export default function ArticleAiAssistant({
  title,
  excerpt,
  content,
  onRequireLogin,
}: ArticleAiAssistantProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const { streaming, error, stream, stop } = useAiStream();

  function buildSystem(): AiChatMessage {
    return {
      role: 'system',
      content:
        `你是这篇文章的智能助手，基于文章内容回答读者的提问，回答简洁准确、使用简体中文。\n\n` +
        `【文章标题】${title}\n\n【文章简介】${excerpt}\n\n【文章正文】\n${content.slice(0, 12000)}`,
    };
  }

  /** 发送消息（system + 历史 + 新消息），流式更新 */
  async function send(userContent: string) {
    const userMsg: UiMsg = { role: 'user', content: userContent };
    const history: AiChatMessage[] = [
      buildSystem(),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    await stream(history, (full) => {
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: full }]);
    });
  }

  /** 一键总结 */
  function handleSummarize() {
    if (!user) {
      onRequireLogin();
      return;
    }
    setOpen(true);
    if (messages.length === 0) void send(SUMMARY_PROMPT);
  }

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void send(text);
  }

  return (
    <section className="mt-12 rounded-lg border border-[var(--color-border-light)] bg-bg-alt/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-[-0.02em]">
          智能助手 <span className="text-sm font-normal text-text-muted">基于本文内容的 AI 问答</span>
        </h2>
        {!open && (
          <button
            type="button"
            onClick={handleSummarize}
            className="cursor-pointer rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            AI 一键总结
          </button>
        )}
        {open && (
          <button
            type="button"
            onClick={() => { setOpen(false); }}
            className="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            收起
          </button>
        )}
      </div>

      {!open && (
        <p className="text-sm text-text-muted">
          点击「AI 一键总结」快速了解文章要点；登录后还可继续向助手提问。
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-sm text-text-muted">正在准备总结…</p>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent text-white'
                    : 'border border-[var(--color-border-light)] bg-surface text-[var(--color-text)]'
                }`}
              >
                {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
              </div>
            </div>
          ))}
          {error && <p className="text-center text-xs text-red-500">{error}</p>}

          {/* 追问输入框 */}
          <form onSubmit={handleSubmit} className="mt-1 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); }}
              placeholder={
                user
                  ? streaming
                    ? '正在生成…'
                    : '向智能助手提问，Enter 发送'
                  : '登录后即可向智能助手提问'
              }
              disabled={streaming || !user}
              className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="shrink-0 cursor-pointer rounded-md border border-red-400/60 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10"
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!user || !input.trim()}
                onClick={() => { if (!user) onRequireLogin(); }}
                className="shrink-0 cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                发送
              </button>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
