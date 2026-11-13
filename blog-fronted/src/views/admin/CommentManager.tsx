'use client'

import Link from 'next/link'

import { useAdminCommentsQuery, useDeleteCommentMutation } from '@/hooks/queries'

/** 文章管理内的轻量评论清理区，不额外增加后台一级导航。 */
export default function CommentManager() {
  const commentsQuery = useAdminCommentsQuery()
  const deleteComment = useDeleteCommentMutation('admin')
  const comments = commentsQuery.data ?? []
  const error = commentsQuery.error ?? deleteComment.error
  const errorMessage = error instanceof Error ? error.message : ''

  async function handleDelete(id: string) {
    if (!window.confirm('确定删除这条评论吗？删除后无法恢复。')) return
    try {
      await deleteComment.mutateAsync(id)
      await commentsQuery.refetch()
    } catch {
      // 错误通过 errorMessage 呈现
    }
  }

  return (
    <section className="mt-12 border-t border-[var(--color-border-light)] pt-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em]">评论管理</h2>
          <p className="mt-1 text-sm text-text-muted">
            展示最近 200 条 GitHub 评论；你可以删除任意一条。
          </p>
        </div>
        <span className="text-sm text-text-muted">{comments.length} 条</span>
      </div>
      {errorMessage && <p className="mb-4 text-sm text-red-500">{errorMessage}</p>}
      {commentsQuery.isLoading ? (
        <p className="py-6 text-sm text-text-muted">评论加载中…</p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-sm text-text-muted">暂时还没有评论。</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-light)] border-y border-[var(--color-border-light)]">
          {comments.map((comment) => (
            <li key={comment.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-muted">
                  <Link
                    href={`/blog/${comment.articleId}`}
                    className="font-medium text-[var(--color-text)] hover:text-accent"
                  >
                    {comment.articleTitle}
                  </Link>
                  <span className="mx-1.5">·</span>@{comment.author.login}
                  <span className="mx-1.5">·</span>
                  {comment.createdAt.slice(0, 10)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                  {comment.content}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleDelete(comment.id)
                }}
                disabled={deleteComment.isPending}
                className="cursor-pointer text-sm text-text-muted hover:text-red-500 disabled:opacity-50"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
