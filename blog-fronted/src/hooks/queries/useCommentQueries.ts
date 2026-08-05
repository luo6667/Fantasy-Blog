import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { commentApi } from '@/lib/api';
import { commentKeys } from '@/lib/queryKeys';
import type { CommentItem } from '@/types/api';

/**
 * 评论查询 / 变更 hooks
 *
 * 评论数据的 mine / likedByMe 字段随当前登录用户变化，
 * 因此查询键按「文章 + 用户」隔离，避免登录态切换后串数据。
 * 发表 / 回复 / 点赞 / 删除成功后失效该文章的评论查询，列表自动刷新。
 */

/** 某篇文章的评论列表 */
export function useCommentsQuery(articleId: string, userId?: string) {
  return useQuery({
    queryKey: commentKeys.byArticle(articleId, userId),
    queryFn: () => commentApi.list(articleId),
  });
}

/** 发表评论 */
export function useCreateCommentMutation(articleId: string, userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => commentApi.create(articleId, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.byArticle(articleId, userId) });
    },
  });
}

/** 回复评论 */
export function useReplyCommentMutation(articleId: string, userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      commentApi.reply(commentId, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.byArticle(articleId, userId) });
    },
  });
}

/** 删除评论（连带子孙回复） */
export function useDeleteCommentMutation(articleId: string, userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => commentApi.remove(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.byArticle(articleId, userId) });
    },
  });
}

/**
 * 点赞 / 取消点赞
 *
 * 乐观更新：先本地翻转点赞状态，失败回滚，完成后以服务端结果校准。
 */
export function useLikeCommentMutation(articleId: string, userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => commentApi.like(commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.byArticle(articleId, userId) });
      const prev = queryClient.getQueryData<CommentItem[]>(
        commentKeys.byArticle(articleId, userId),
      );
      if (prev) {
        queryClient.setQueryData<CommentItem[]>(commentKeys.byArticle(articleId, userId), (old) =>
          old?.map((c) =>
            c.id === commentId
              ? { ...c, likedByMe: !c.likedByMe, likes: c.likes + (c.likedByMe ? -1 : 1) }
              : c,
          ),
        );
      }
      return { prev };
    },
    onError: (_error, _commentId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(commentKeys.byArticle(articleId, userId), ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.byArticle(articleId, userId) });
    },
  });
}
