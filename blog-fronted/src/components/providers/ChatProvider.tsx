'use client';

import { type ReactNode, useEffect } from 'react';

import { useNotificationsUnreadQuery } from '@/hooks/queries/useSocialQueries';
import { tokenStore } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';

interface ChatProviderProps {
  children: ReactNode;
}

/**
 * 聊天 / 通知 Provider
 *
 * 登录后自动建立 Socket.IO 连接（断线自动重连），
 * 并同步初始通知未读数。登出时断开连接。
 */
export default function ChatProvider({ children }: ChatProviderProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const connect = useChatStore((s) => s.connect);
  const disconnect = useChatStore((s) => s.disconnect);
  const setUnreadNotifications = useChatStore((s) => s.setUnreadNotifications);
  const setChatOpen = useChatStore((s) => s.setChatOpen);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  // 连接 Socket.IO（登录后）
  useEffect(() => {
    if (!userId) return;
    const token = tokenStore.get();
    if (!token) return;
    connect(token);
    return () => {
      disconnect();
    };
  }, [userId, connect, disconnect]);

  // 退出登录：关闭聊天窗口并清空会话（输入框随组件卸载自动清空）
  useEffect(() => {
    if (!userId) {
      setChatOpen(false);
      setActiveConversation(null);
    }
  }, [userId, setChatOpen, setActiveConversation]);

  // 初始同步通知未读数
  const { data: unread } = useNotificationsUnreadQuery(Boolean(userId));
  useEffect(() => {
    if (userId && typeof unread?.count === 'number') {
      setUnreadNotifications(unread.count);
    }
  }, [userId, unread, setUnreadNotifications]);

  return children;
}
