import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { articleApi, notificationApi, userApi } from '@/lib/api';

/**
 * 通知 / 用户管理查询 hooks
 *
 * - 通知：列表 / 未读数 / 标记已读（纯 REST，无实时推送——SSE 已随私信功能下线）
 * - 用户管理：管理员列表 / 删除
 * - 文章点赞：成功后直接更新文章详情缓存，再失效文章列表
 */

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
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

/** 通知未读数（进入页面 / 登录态变化时拉取） */
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
