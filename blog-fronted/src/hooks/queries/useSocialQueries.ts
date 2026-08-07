import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { articleApi, conversationApi, messageApi, notificationApi, userApi } from '@/lib/api';
import type { MessageItem, UserBrief } from '@/types/api';

/**
 * 社交功能查询 hooks：通知 / 我的收藏 / 会话 / 私信 / 用户搜索
 *
 * - 会话列表在收到 Socket.IO 推送（message:new）后由 chatStore 失效刷新
 * - 点赞/收藏成功后直接更新文章详情缓存，再失效文章列表
 */

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
};

export const conversationKeys = {
  all: ['conversations'] as const,
  messages: (conversationId: string) =>
    [...conversationKeys.all, conversationId, 'messages'] as const,
};

export const favoriteKeys = {
  all: ['favorite-articles'] as const,
};

export const manageUserKeys = {
  all: ['users', 'manage'] as const,
};

/** 通知列表 */
export function useNotificationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: notificationApi.list,
    enabled,
  });
}

/** 通知未读数（收到 notification:new 推送时由 store 增量更新，这里用于初始同步） */
export function useNotificationsUnreadQuery(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationApi.unreadCount,
    enabled,
  });
}

/** 标记通知已读（ids 缺省全部） */
export function useMarkNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => notificationApi.markRead(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    },
  });
}

/** 我收藏的文章列表 */
export function useFavoriteArticlesQuery(enabled: boolean) {
  return useQuery({
    queryKey: favoriteKeys.all,
    queryFn: articleApi.favorites,
    enabled,
  });
}

/** 文章点赞 / 取消 */
export function useArticleLikeMutation(articleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => articleApi.like(articleId),
    onSuccess: (result) => {
      queryClient.setQueryData(['article', articleId], (old) => {
        if (!old) return old;
        return { ...old, likedByMe: result.liked, likes: result.likes };
      });
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

/** 文章收藏 / 取消（收藏成功时后端自动通知文章作者） */
export function useArticleFavoriteMutation(articleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => articleApi.favorite(articleId),
    onSuccess: (result) => {
      queryClient.setQueryData(['article', articleId], (old) => {
        if (!old) return old;
        return { ...old, favoritedByMe: result.favorited, favorites: result.favorites };
      });
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}

/** 会话列表（登录后启用） */
export function useConversationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: conversationKeys.all,
    queryFn: conversationApi.list,
    enabled,
  });
}

/** 会话历史消息 */
export function useConversationMessagesQuery(conversationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId ?? ''),
    queryFn: () => conversationApi.messages(conversationId as string),
    enabled: enabled && Boolean(conversationId),
  });
}

/** 发送私信（自动创建/复用会话） */
export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipientType, recipientId, content }: { recipientType: 'user' | 'admin'; recipientId: string; content: string }) =>
      messageApi.send(recipientType, recipientId, content),
    onSuccess: (msg) => {
      // 追加到当前会话消息缓存（按 id 去重），刷新会话列表
      queryClient.setQueryData<MessageItem[]>(conversationKeys.messages(msg.conversationId), (old) =>
        old && old.some((m) => m.id === msg.id) ? old : [...(old ?? []), msg],
      );
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** 标记会话已读 */
export function useMarkConversationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => conversationApi.markRead(conversationId),
    onSuccess: (_data, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** 搜索可聊天的用户（空 search 返回全部用户；由调用方控制启用与防抖） */
export function useSearchUsersQuery(search: string, enabled = true) {
  return useQuery({
    queryKey: ['users', 'search', search],
    queryFn: () => userApi.search(search),
    enabled,
    placeholderData: (prev: UserBrief[] | undefined) => prev,
  });
}

/** 管理端用户列表 + 统计（管理员） */
export function useUsersManageQuery() {
  return useQuery({
    queryKey: manageUserKeys.all,
    queryFn: userApi.listManage,
  });
}

/** 删除用户及级联数据（管理员） */
export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manageUserKeys.all });
    },
  });
}
