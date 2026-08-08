import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useAiStream } from '@/hooks/useAiStream';
import { useAuth } from '@/hooks/useAuth';
import type { AiChatMessage } from '@/types/api';

const MAX_SELECT = 3000;
/** 面板最大高度：小屏时收缩，保证不超出视口 */
const PANEL_MAX_HEIGHT = 'calc(100vh - 8rem)';

interface UiMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface Selected {
  /** 划选文本（已 trim） */
  text: string;
  /** 「AI 解释」按钮锚点（视口坐标，fixed 定位用，已 clamp 到视口内） */
  x: number;
  y: number;
}

interface SelectionAiPopoverProps {
  /** 正文容器：只对容器内划选生效（段落 / 术语 / 代码） */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 文章标题（作为解释上下文） */
  title: string;
  /** 文章简介（作为解释上下文） */
  excerpt: string;
  /** 未登录时点击触发（由父级打开登录弹窗） */
  onRequireLogin: () => void;
}

/**
 * 划词 AI（文章详情页）
 *
 * - 在正文内划选任意内容（段落 / 单词 / 单个词 / 代码）后，选区下方弹出「AI 解释」按钮
 * - 每次点击「AI 解释」都相当于发一条新问题（历史记录保留），可连续划选追加提问
 * - AI 未回复时显示「思考中…」，回复后流式输出
 * - 解释面板统一固定在文章右侧（不跟随划选移动），可按住顶部手柄拖动
 * - 面板打开后点正文继续划选提问不会关闭面板；✕ / Esc 关闭
 * - 未登录点击时由父级打开登录弹窗（与智能助手一致）
 */
export default function SelectionAiPopover({
  containerRef,
  title,
  excerpt,
  onRequireLogin,
}: SelectionAiPopoverProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [open, setOpen] = useState(false);
  /** 最近一次提问的划选内容（selected 被清除后兜底展示） */
  const [lastAskedText, setLastAskedText] = useState('');
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [input, setInput] = useState('');
  const { streaming, error, stream, stop } = useAiStream();

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 拖拽移动面板（按住顶部手柄拖动）：pointermove 只更新 motionValue，
  // 不触发 React 重渲染，消息列表/流式输出不会每帧全量刷新
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  function onHeaderPointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return; // 关闭按钮不触发拖动
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: dragX.get(), originY: dragY.get() };
    const move = (ev: globalThis.PointerEvent) => {
      const s = dragState.current;
      if (!s) return;
      dragX.set(s.originX + ev.clientX - s.startX);
      dragY.set(s.originY + ev.clientY - s.startY);
    };
    const up = () => {
      dragState.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** 解释用的 system 消息（带文章标题 / 简介作为上下文） */
  function buildSystem(): AiChatMessage {
    return {
      role: 'system',
      content:
        '你是这篇技术博客的智能助手，用户划选了文章中的一段内容（可能是一个术语、一句话或一段代码），' +
        '请结合文章上下文解释它的含义、作用或原理。若为代码，说明它做了什么、关键点在哪里。' +
        '回答使用简体中文，简洁准确，一般不超过 300 字。\n\n' +
        `【文章标题】${title}\n\n【文章简介】${excerpt}`,
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

  /**
   * 划选检测：mouseup 时检查选区是否落在正文容器内。
   * 只要求有实际文本（哪怕单个词），不限制选区尺寸，保证双击选词也能弹出按钮。
   */
  useEffect(() => {
    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const anchor = sel.anchorNode;
      const focus = sel.focusNode;
      if (!containerRef.current?.contains(anchor) && !containerRef.current?.contains(focus)) {
        return; // 选区不在正文容器内（标题 / 评论区 / 页面其他区域）
      }
      const text = sel.toString().trim().slice(0, MAX_SELECT);
      if (!text) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelected({
        text,
        // 按钮锚点 clamp 到视口内，避免划选靠近屏幕边缘时按钮跑出可视区
        x: Math.min(Math.max(rect.left, 8), window.innerWidth - 160),
        y: Math.min(Math.max(rect.bottom + 8, 8), window.innerHeight - 48),
      });
    }

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      // 点击面板外部：只清除划选按钮；面板保持打开，方便连续划选提问（✕ / Esc 关闭）
      setSelected(null);
    }

    /** 滚动时隐藏划选按钮（面板固定在文章右侧，不跟随滚动） */
    function handleScroll() {
      setSelected(null);
    }

    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [containerRef]);

  /** 点击「AI 解释」：未登录先弹登录；每次点击都追加一条新问题（历史保留） */
  function handleAsk() {
    if (!selected || streaming) return;
    if (!user) {
      onRequireLogin();
      return;
    }
    setLastAskedText(selected.text);
    // 首次打开：重置拖拽偏移（面板贴回文章右侧默认位）
    if (!open) {
      dragX.set(0);
      dragY.set(0);
      setOpen(true);
    }
    void send(`请解释以下划选内容：\n\n"""\n${selected.text}\n"""`);
  }

  /** 追问（复用当前会话上下文） */
  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void send(text);
  }

  /** 输入区：Enter 发送，Shift+Enter 换行 */
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  /** user 消息展示：划选内容太长时截断 */
  function displayUser(content: string): string {
    const m = content.match(/"""\n([\s\S]*?)\n"""$/);
    if (!m) return content;
    const t = m[1] ?? '';
    return `划选内容：${t.length > 120 ? `${t.slice(0, 120)}…` : t}`;
  }

  /** 流式更新时消息长度不变，用最后一条消息内容长度触发自动滚底 */
  const lastMsgLen = messages.length > 0 ? (messages[messages.length - 1]?.content.length ?? 0) : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastMsgLen]);

  return (
    <>
      {/* 划选后弹出的「AI 解释」按钮（每次点击发一条新问题） */}
      {selected && !streaming && (
        <button
          ref={btnRef}
          type="button"
          onClick={handleAsk}
          className="fixed z-[985] cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition-transform hover:scale-105"
          style={{ left: selected.x, top: selected.y }}
        >
          ✨ AI 解释
        </button>
      )}

      {/* 解释面板（固定在文章右侧，顶部手柄可拖动） */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            key="selection-ai-panel"
            className="fixed right-4 top-24 z-[990] flex w-96 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
            style={{ x: dragX, y: dragY, height: PANEL_MAX_HEIGHT }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            {/* 顶部：拖动手柄 + 标题 + 关闭 */}
            <div
              className="flex cursor-grab items-center justify-between border-b border-[var(--color-border-light)] px-3 py-2.5 active:cursor-grabbing"
              onPointerDown={onHeaderPointerDown}
              title="按住拖动"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="select-none text-base leading-none text-text-muted"
                  aria-hidden
                >
                  ≡
                </span>
                <span className="text-sm font-semibold">AI 解释</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); }}
                  className="cursor-pointer rounded-md px-1.5 text-sm text-text-muted transition-colors hover:text-accent"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 划选内容引用（超出滚动；selected 被清除时兜底显示最近提问内容） */}
            <div className="max-h-16 overflow-y-auto border-b border-[var(--color-border-light)] bg-bg-alt/50 px-4 py-2 text-xs leading-relaxed text-text-muted">
              <span className="mr-1 font-medium text-text-secondary">选中：</span>
              {selected?.text ?? lastAskedText}
            </div>

            {/* 对话区（自动滚动到底部；未回复时显示「思考中…」） */}
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {messages.length === 0 && (
                <p className="pt-6 text-center text-xs text-text-muted">划选正文内容，点击「AI 解释」提问</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-accent text-white'
                        : 'border border-[var(--color-border-light)] bg-bg-alt text-[var(--color-text)]'
                    }`}
                  >
                    {m.role === 'user'
                      ? displayUser(m.content)
                      : (m.content ||
                        (streaming && i === messages.length - 1 ? '思考中…' : ''))}
                  </div>
                </div>
              ))}
              {error && <p className="text-center text-xs text-red-500">{error}</p>}
            </div>

            {/* 输入区（textarea，Enter 发送 / Shift+Enter 换行） */}
            <div className="border-t border-[var(--color-border-light)] p-2.5">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => { setInput(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder={streaming ? '正在生成…' : '继续追问，Enter 发送'}
                  disabled={streaming}
                  rows={2}
                  maxLength={1000}
                  className="min-w-0 flex-1 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="shrink-0 cursor-pointer self-end rounded-md border border-red-400/60 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/10"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="shrink-0 cursor-pointer self-end rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    发送
                  </button>
                )}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
