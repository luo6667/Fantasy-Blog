import { AnimatePresence, motion } from 'motion/react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useConversationMessagesQuery,
  useConversationsQuery,
  useMarkConversationReadMutation,
  useSearchUsersQuery,
  useSendMessageMutation,
} from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { useChatStore } from '@/stores/chatStore';
import type { ConversationItem, UserBrief } from '@/types/api';

/**
 * 私信聊天弹窗（登录后可用）
 *
 * - 左侧：会话列表（对方名 / 最后消息 / 未读红点 / 在线绿点）+ 新会话（搜索用户）
 * - 右侧：消息气泡 + 输入框（Enter 发送，Shift+Enter 换行）
 * - 对方「正在输入」实时提示（Socket.IO typing 事件）
 * - 打开会话自动标记已读；离线消息由后端落库，重连后列表拉取
 */
export default function ChatWindow({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const typing = useChatStore((s) => s.typing);
  const emitTyping = useChatStore((s) => s.emitTyping);

  const [text, setText] = useState('');
  const [newChatMode, setNewChatMode] = useState(false);
  const [newPeer, setNewPeer] = useState<UserBrief | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const { data: conversations = [] } = useConversationsQuery(true);
  const { data: messages = [], isLoading: msgLoading } = useConversationMessagesQuery(
    activeConversationId,
    Boolean(activeConversationId),
  );
  const { data: searchResults = [] } = useSearchUsersQuery(
    newChatMode ? userSearch : '',
    newChatMode,
  );
  const markRead = useMarkConversationReadMutation();
  // mutate 引用稳定，仅依赖会话 id，避免每次渲染重复标记已读
  const markReadFn = markRead.mutate;
  const sendMessage = useSendMessageMutation();

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTypingAt = useRef(0);

  // 拖拽移动聊天窗口（按住顶部标题栏拖动）
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  function onHeaderPointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: dragPos.x, originY: dragPos.y };
    const move = (ev: globalThis.PointerEvent) => {
      const s = dragState.current;
      if (!s) return;
      setDragPos({ x: s.originX + ev.clientX - s.startX, y: s.originY + ev.clientY - s.startY });
    };
    const up = () => {
      dragState.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // 打开会话：标记已读
  useEffect(() => {
    if (activeConversationId) {
      markReadFn(activeConversationId);
    }
  }, [activeConversationId, markReadFn]);

  // 新消息滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeConversationId]);

  const activePeer: { role: 'user' | 'admin'; id: string; username: string } | null = newPeer
    ? newPeer
    : (() => {
        const conv = conversations.find((c) => c.id === activeConversationId);
        return conv ? conv.peer : null;
      })();

  const typingInfo = activeConversationId ? typing[activeConversationId] : undefined;

  /** 输入时上报「正在输入」（节流 800ms） */
  function handleTyping() {
    if (!activePeer || !activeConversationId) return;
    const now = Date.now();
    if (now - lastTypingAt.current < 800) return;
    lastTypingAt.current = now;
    emitTyping({
      recipientType: activePeer.role,
      recipientId: activePeer.id,
      conversationId: activeConversationId,
      isTyping: true,
    });
  }

  /** 发送消息（新会话自动创建） */
  async function handleSend() {
    const content = text.trim();
    if (!content || !user || sendMessage.isPending) return;
    if (newPeer) {
      const msg = await sendMessage.mutateAsync({
        recipientType: newPeer.role,
        recipientId: newPeer.id,
        content,
      });
      setActiveConversation(msg.conversationId);
      setNewPeer(null);
      setNewChatMode(false);
    } else if (activeConversationId && activePeer) {
      await sendMessage.mutateAsync({
        recipientType: activePeer.role,
        recipientId: activePeer.id,
        content,
      });
    }
    setText('');
    if (activeConversationId && activePeer) {
      emitTyping({
        recipientType: activePeer.role,
        recipientId: activePeer.id,
        conversationId: activeConversationId,
        isTyping: false,
      });
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function selectConversation(conv: ConversationItem) {
    setNewPeer(null);
    setNewChatMode(false);
    setActiveConversation(conv.id);
  }

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-[960] flex h-[30rem] w-[min(46rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
      style={{ transform: `translate(${String(dragPos.x)}px, ${String(dragPos.y)}px)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* 左侧：会话列表 / 新会话 */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border-light)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-light)] px-3 py-2.5">
          <span className="text-sm font-semibold">消息</span>
          <button
            type="button"
            onClick={() => {
              setNewChatMode(!newChatMode);
              setNewPeer(null);
            }}
            className="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            {newChatMode ? '← 会话' : '+ 新会话'}
          </button>
        </div>

        {newChatMode ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <input
              autoFocus
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); }}
              placeholder="搜索用户名…"
              className="mx-3 mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {searchResults.map((u) => (
                <li key={`${u.role}:${u.id}`}>
                  <button
                    type="button"
                    onClick={() => { setNewPeer(u); setUserSearch(''); }}
                    className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-bg-alt ${
                      newPeer?.id === u.id ? 'bg-bg-alt' : ''
                    }`}
                  >
                    <span className="truncate font-medium">{u.username}</span>
                    {u.role === 'admin' && (
                      <span className="rounded-full bg-accent-soft px-1.5 text-[0.625rem] text-accent">管理员</span>
                    )}
                  </button>
                </li>
              ))}
              {userSearch.trim() === '' && searchResults.length === 0 && (
                <li className="px-3 py-2 text-xs text-text-muted">暂无其他用户</li>
              )}
              {userSearch.trim() !== '' && searchResults.length === 0 && (
                <li className="px-3 py-2 text-xs text-text-muted">未找到用户</li>
              )}
            </ul>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-text-muted">
                暂无会话，点击「+ 新会话」找人聊天
              </li>
            )}
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => { selectConversation(conv); }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-bg-alt ${
                    activeConversationId === conv.id ? 'bg-bg-alt' : ''
                  }`}
                >
                  <span className="relative shrink-0">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                      {conv.peer.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-bg)] ${
                        conv.isOnline ? 'bg-green-500' : 'bg-text-muted/40'
                      }`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-medium">{conv.peer.username}</span>
                      {conv.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[0.625rem] font-semibold text-white">
                          {conv.unread}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {typing[conv.id] ? '正在输入…' : (conv.lastMessage || '暂无消息')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 右侧：消息区 */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex cursor-grab items-center justify-between border-b border-[var(--color-border-light)] px-4 py-2.5 active:cursor-grabbing"
          onPointerDown={onHeaderPointerDown}
          title="按住拖动"
        >
          <span className="text-sm font-semibold">
            {activePeer ? activePeer.username : newChatMode ? '选择会话对象' : '选择一个会话'}
            {activePeer && !newPeer && (
              <span className="ml-2 text-xs font-normal text-text-muted">
                {conversations.find((c) => c.id === activeConversationId)?.isOnline ? '在线' : '离线'}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md px-2 py-0.5 text-sm text-text-muted transition-colors hover:bg-bg-alt hover:text-[var(--color-text)]"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {!activePeer && (
            <p className="pt-16 text-center text-xs text-text-muted">选择左侧会话开始聊天</p>
          )}
          {activePeer && msgLoading && (
            <p className="pt-16 text-center text-xs text-text-muted">消息加载中…</p>
          )}
          {activePeer && !msgLoading && messages.length === 0 && (
            <p className="pt-16 text-center text-xs text-text-muted">还没有消息，发送第一条吧</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  m.mine
                    ? 'bg-accent text-white'
                    : 'border border-[var(--color-border-light)] bg-bg-alt text-[var(--color-text)]'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {typingInfo && (
            <p className="text-center text-xs text-text-muted">{typingInfo.username} 正在输入…</p>
          )}
        </div>

        <div className="border-t border-[var(--color-border-light)] p-2.5">
          {newPeer && (
            <p className="mb-1.5 px-1 text-xs text-text-muted">
              正在与 <span className="font-medium text-accent">{newPeer.username}</span> 发起新会话
            </p>
          )}
          <textarea
            value={text}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setText(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            disabled={!activePeer || sendMessage.isPending}
            placeholder={activePeer ? '输入消息，Enter 发送，Shift+Enter 换行' : '先选择会话'}
            maxLength={1000}
            rows={2}
            className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50"
          />
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              disabled={!activePeer || text.trim() === '' || sendMessage.isPending}
              onClick={() => { void handleSend(); }}
              className="cursor-pointer rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {sendMessage.isPending ? '发送中…' : '发送'}
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

/** 聊天窗口容器（控制开关动画） */
export function ChatWindowHost() {
  const chatOpen = useChatStore((s) => s.chatOpen);
  const setChatOpen = useChatStore((s) => s.setChatOpen);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  return (
    <AnimatePresence>
      {chatOpen && (
        <ChatWindow
          onClose={() => {
            setActiveConversation(null);
            setChatOpen(false);
          }}
        />
      )}
    </AnimatePresence>
  );
}
