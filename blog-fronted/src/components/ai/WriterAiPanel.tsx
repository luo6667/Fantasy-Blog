import { type SyntheticEvent, useState } from 'react';

import { useAiStream } from '@/hooks/useAiStream';
import type { AiChatMessage } from '@/types/api';

const WRITER_SYSTEM: AiChatMessage = {
  role: 'system',
  content:
    '你是一名资深技术博客写作助手。你的任务：帮助作者优化文章的标题、简介（摘要）与正文。' +
    '回答使用简体中文，直接给出可用的建议内容，不要输出多余的客套话。' +
    '当作者请求「检测/分析」时，指出问题并给出改进建议；当作者请求「生成」时，直接生成内容。',
};

interface WriterAiPanelProps {
  title: string;
  excerpt: string;
  content: string;
  /** 把 AI 生成的内容插入正文（光标处或末尾） */
  onInsert: (text: string) => void;
}

interface UiMsg {
  role: 'user' | 'assistant';
  content: string;
}

const btnGhost =
  'cursor-pointer rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent';

/**
 * 写文章页 AI 助手（右下角浮动面板）
 *
 * - 快捷动作：检测标题 / 检测简介 / 检测正文（把对应字段发给 AI 分析建议）
 * - 自由对话：输入指令，AI 流式回复
 * - 每条 AI 回复可「插入到正文」，由调用方写入编辑器
 */
export default function WriterAiPanel({ title, excerpt, content, onInsert }: WriterAiPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const { streaming, error, stream, stop } = useAiStream();

  /** 发送一组消息（含 system），流式更新对话 */
  async function send(userContent: string) {
    const userMsg: UiMsg = { role: 'user', content: userContent };
    const history: AiChatMessage[] = [
      WRITER_SYSTEM,
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];
    setMessages([...messages, userMsg, { role: 'assistant', content: '' }]);
    await stream(history, (full) => {
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: full }]);
    });
  }

  /** 快捷检测：附带当前字段内容 */
  function quickCheck(label: string, fieldContent: string) {
    if (!fieldContent.trim()) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `（当前「${label}」为空，请先填写后再检测）` },
      ]);
      return;
    }
    void send(`请检测我的文章${label}并给出改进建议：\n\n"""\n${fieldContent.slice(0, 8000)}\n"""`);
  }

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void send(text);
  }

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); }}
        className="fixed bottom-6 right-6 z-[980] flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-accent text-xl font-bold text-white shadow-lg transition-transform hover:scale-105"
        title={open ? '收起 AI 助手' : '打开 AI 写作助手'}
      >
        {open ? '✕' : 'AI'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[980] flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-light)] px-4 py-2.5">
            <span className="text-sm font-semibold">AI 写作助手</span>
            <span className="text-xs text-text-muted">对话生成 · 可插入正文</span>
          </div>

          {/* 快捷动作 */}
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-border-light)] px-3 py-2">
            <button type="button" className={btnGhost} onClick={() => { quickCheck('标题', title); }}>
              检测标题
            </button>
            <button type="button" className={btnGhost} onClick={() => { quickCheck('简介', excerpt); }}>
              检测简介
            </button>
            <button type="button" className={btnGhost} onClick={() => { quickCheck('正文', content); }}>
              检测正文
            </button>
          </div>

          {/* 对话区 */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <p className="pt-8 text-center text-xs text-text-muted">
                点击上方「检测」按钮，或直接输入指令，例如：
                <br />「根据标题和简介，帮我写一段正文开头」
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-accent text-white'
                      : 'border border-[var(--color-border-light)] bg-bg-alt text-[var(--color-text)]'
                  }`}
                >
                  {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
                  {m.role === 'assistant' && m.content && i === messages.length - 1 && !streaming && (
                    <button
                      type="button"
                      onClick={() => { onInsert(m.content); }}
                      className="mt-2 block cursor-pointer rounded-md border border-accent/40 px-2 py-0.5 text-xs text-accent transition-colors hover:bg-accent-soft"
                    >
                      ↑ 插入到正文
                    </button>
                  )}
                </div>
              </div>
            ))}
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
          </div>

          {/* 输入区 */}
          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--color-border-light)] p-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); }}
              placeholder={streaming ? '正在生成…' : '输入指令，Enter 发送'}
              disabled={streaming}
              className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50"
            />
            {streaming ? (
              <button type="button" onClick={stop} className="shrink-0 cursor-pointer rounded-md border border-red-400/60 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/10">
                停止
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="shrink-0 cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                发送
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
