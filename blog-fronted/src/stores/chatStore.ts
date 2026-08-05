import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

import { conversationKeys, notificationKeys } from '@/hooks/queries/useSocialQueries';
import { conversationApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { ConversationItem, MessageItem, NotificationItem, UserRole } from '@/types/api';

/**
 * 聊天 / 通知 Store（zustand）
 *
 * 管理 Socket.IO 连接与实时事件：
 * - message:new：若当前正打开该会话则追加消息并标记已读，否则会话列表未读（invalidate 刷新）
 * - notification:new：通知未读数 +1 并失效通知列表
 * - typing：记录「正在输入」，2.5s 后自动清除
 *
 * 消息本身由 REST 落库（离线不丢），Socket 只负责实时性。
 */

interface TypingInfo {
  conversationId: string;
  username: string;
  until: number;
}

interface ChatState {
  socket: Socket | null;
  connected: boolean;
  /** 通知未读徽标数 */
  unreadNotifications: number;
  /** 聊天窗口开关 */
  chatOpen: boolean;
  /** 通知面板开关（Nav 内） */
  notificationsOpen: boolean;
  /** 当前正在查看的会话（用于消息实时追加与已读判断） */
  activeConversationId: string | null;
  /** 正在输入的会话集合 */
  typing: Record<string, TypingInfo>;
  connect: (token: string) => void;
  disconnect: () => void;
  setUnreadNotifications: (count: number) => void;
  bumpUnreadNotifications: () => void;
  setChatOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setActiveConversation: (conversationId: string | null) => void;
  emitTyping: (payload: {
    recipientType: UserRole;
    recipientId: string;
    conversationId: string;
    isTyping: boolean;
  }) => void;
}

/** typing 提示保留时长 */
const TYPING_TTL = 2500;

export const useChatStore = create<ChatState>()((set, get) => ({
  socket: null,
  connected: false,
  unreadNotifications: 0,
  chatOpen: false,
  notificationsOpen: false,
  activeConversationId: null,
  typing: {},

  connect: (token) => {
    if (get().socket) return;
    const s = io({ auth: { token } });

    s.on('connect', () => {
      set({ connected: true });
      // 重连后重新拉取会话列表与通知未读，补齐离线期间到达的消息
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    });
    s.on('disconnect', () => {
      set({ connected: false });
    });

    // 收到私信：正在看该会话则实时追加（按 id 去重），否则更新未读
    s.on('message:new', (msg: MessageItem) => {
      const { chatOpen, activeConversationId } = get();
      if (chatOpen && activeConversationId === msg.conversationId) {
        queryClient.setQueryData<MessageItem[]>(
          conversationKeys.messages(msg.conversationId),
          (old) => (old && old.some((m) => m.id === msg.id) ? old : [...(old ?? []), msg]),
        );
        void conversationApi.markRead(msg.conversationId).catch(() => {
          /* 标记已读失败不影响展示 */
        });
      } else {
        // 乐观更新该会话未读数，并刷新会话列表
        queryClient.setQueryData(
          conversationKeys.all,
          (old: ConversationItem[] | undefined) =>
            old?.map((c) => (c.id === msg.conversationId ? { ...c, unread: c.unread + 1 } : c)),
        );
      }
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    });

    // 收到通知：面板未打开时未读 +1
    s.on('notification:new', (_n: NotificationItem) => {
      if (!get().notificationsOpen) {
        set((st) => ({ unreadNotifications: st.unreadNotifications + 1 }));
      }
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    });

    // 对方正在输入
    s.on('typing', (data: { conversationId: string; sender: { username: string }; isTyping: boolean }) => {
      if (!data.isTyping) {
        set((st) => {
          const { [data.conversationId]: _removed, ...rest } = st.typing;
          return { typing: rest };
        });
        return;
      }
      set((st) => ({
        typing: {
          ...st.typing,
          [data.conversationId]: { conversationId: data.conversationId, username: data.sender.username, until: Date.now() + TYPING_TTL },
        },
      }));
      window.setTimeout(() => {
        const info = get().typing[data.conversationId];
        if (info && info.until <= Date.now()) {
          set((st) => {
            const { [data.conversationId]: _removed, ...rest } = st.typing;
            return { typing: rest };
          });
        }
      }, TYPING_TTL);
    });

    set({ socket: s });
  },

  disconnect: () => {
    const { socket } = get();
    socket?.disconnect();
    set({ socket: null, connected: false, typing: {} });
  },

  setUnreadNotifications: (count) => {
    set({ unreadNotifications: count });
  },
  bumpUnreadNotifications: () => {
    set((st) => ({ unreadNotifications: st.unreadNotifications + 1 }));
  },
  setChatOpen: (open) => {
    set({ chatOpen: open });
  },
  setNotificationsOpen: (open) => {
    set({ notificationsOpen: open });
  },
  setActiveConversation: (conversationId) => {
    set({ activeConversationId: conversationId });
  },

  emitTyping: (payload) => {
    get().socket?.emit('typing', payload);
  },
}));
