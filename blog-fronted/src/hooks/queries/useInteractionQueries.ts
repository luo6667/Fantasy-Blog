import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { githubCommentAuthApi, interactionApi } from '@/lib/api'
import { interactionKeys } from '@/lib/queryKeys'
import type { ReactionType } from '@/types/api'

/** 当前浏览器的 GitHub 评论身份；未登录时保持空数据，不重试。 */
export function useGitHubCommenterQuery() {
  return useQuery({
    queryKey: interactionKeys.commenter,
    queryFn: githubCommentAuthApi.me,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useArticleCommentsQuery(articleID: string) {
  return useQuery({
    queryKey: interactionKeys.comments(articleID),
    queryFn: () => interactionApi.comments(articleID),
    enabled: Boolean(articleID),
    staleTime: 30_000,
  })
}

export function useAdminCommentsQuery() {
  return useQuery({
    queryKey: ['admin', 'comments'],
    queryFn: interactionApi.adminComments,
    staleTime: 30_000,
  })
}

export function useArticleReactionsQuery(articleID: string) {
  return useQuery({
    queryKey: interactionKeys.reactions(articleID),
    queryFn: () => interactionApi.reactions(articleID),
    enabled: Boolean(articleID),
    staleTime: 30_000,
  })
}

export function useCreateCommentMutation(articleID: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => interactionApi.createComment(articleID, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: interactionKeys.comments(articleID) })
    },
  })
}

export function useDeleteCommentMutation(articleID: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentID: string) => interactionApi.deleteComment(commentID),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: interactionKeys.comments(articleID) })
    },
  })
}

export function useSetReactionMutation(articleID: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (type: ReactionType) => interactionApi.setReaction(articleID, type),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: interactionKeys.reactions(articleID) })
    },
  })
}

export function useRemoveReactionMutation(articleID: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => interactionApi.removeReaction(articleID),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: interactionKeys.reactions(articleID) })
    },
  })
}
