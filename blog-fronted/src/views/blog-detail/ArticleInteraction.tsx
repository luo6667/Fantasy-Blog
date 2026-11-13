'use client'

import Image from 'next/image'
import { type SyntheticEvent, useState } from 'react'

import { SafeImg } from '@/components/common'
import {
  useArticleCommentsQuery,
  useArticleReactionsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useGitHubCommenterQuery,
  useRemoveReactionMutation,
  useSetReactionMutation,
} from '@/hooks/queries'
import { githubCommentAuthApi } from '@/lib/api'
import type { ReactionType } from '@/types/api'

const REACTIONS: Array<{ type: ReactionType; image: string; label: string }> = [
  { type: 'love', image: '/reactions/love.gif', label: '很喜欢' },
  { type: 'confused', image: '/reactions/confused.gif', label: '困惑' },
  { type: 'correction', image: '/reactions/correction.gif', label: '有错误' },
]

function displayName(name: string, login: string) {
  return name.trim() || login
}

/** 文章底部的 GitHub 表情与单层评论区。 */
export default function ArticleInteraction({
  articleID,
  isAdmin,
}: {
  articleID: string
  isAdmin: boolean
}) {
  const [content, setContent] = useState('')
  const commenterQuery = useGitHubCommenterQuery()
  const commentsQuery = useArticleCommentsQuery(articleID)
  const reactionsQuery = useArticleReactionsQuery(articleID)
  const createComment = useCreateCommentMutation(articleID)
  const deleteComment = useDeleteCommentMutation(articleID)
  const setReaction = useSetReactionMutation(articleID)
  const removeReaction = useRemoveReactionMutation(articleID)
  const commenter = commenterQuery.data
  const reactions = reactionsQuery.data

  function startLogin() {
    githubCommentAuthApi.start(`/blog/${articleID}`)
  }

  async function handleReaction(type: ReactionType) {
    if (!commenter) {
      startLogin()
      return
    }
    try {
      if (reactions?.current === type) await removeReaction.mutateAsync()
      else await setReaction.mutateAsync(type)
    } catch {
      // mutation error is rendered below the interaction buttons
    }
  }

  async function submitComment(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!commenter) {
      startLogin()
      return
    }
    if (!content.trim()) return
    try {
      await createComment.mutateAsync(content.trim())
      setContent('')
    } catch {
      // mutation error is rendered by the form
    }
  }

  const mutationError =
    createComment.error ?? setReaction.error ?? removeReaction.error ?? deleteComment.error
  const errorMessage = mutationError instanceof Error ? mutationError.message : ''

  return (
    <section
      className="mt-14 border-t border-[var(--color-border-light)] pt-8"
      aria-label="文章互动"
    >
      <div className="border-b border-[var(--color-border-light)] pb-10 text-center">
        <p className="text-sm font-semibold text-[var(--color-text)]">这篇文章对你有帮助吗？</p>
        <p className="mt-1 text-sm text-text-muted">使用 GitHub 登录后可留下一个反馈。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-5 sm:gap-7">
          {REACTIONS.map((reaction) => {
            const active = reactions?.current === reaction.type
            const count = reactions?.[reaction.type] ?? 0
            return (
              <button
                key={reaction.type}
                type="button"
                onClick={() => {
                  void handleReaction(reaction.type)
                }}
                disabled={setReaction.isPending || removeReaction.isPending}
                aria-pressed={active}
                className={`flex h-32 w-24 cursor-pointer flex-col items-center justify-between rounded-lg border bg-bg-alt px-2 py-2 text-[0.8125rem] transition-all duration-200 hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60 ${
                  active
                    ? 'border-accent bg-accent-soft text-accent shadow-[0_10px_24px_color-mix(in_srgb,var(--color-accent)_16%,transparent)]'
                    : 'border-[var(--color-border-light)] text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                <Image
                  src={reaction.image}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 object-contain"
                />
                <span className="font-medium">
                  {reaction.label} <span className="ml-1 text-text-muted">{count}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold tracking-[-0.02em]">评论</h2>
          <span className="text-sm text-text-muted">{commentsQuery.data?.length ?? 0} 条</span>
        </div>

        <form
          onSubmit={(event) => {
            void submitComment(event)
          }}
          className="mt-5 rounded-md border border-[var(--color-border-light)] bg-surface p-4"
        >
          {commenter ? (
            <p className="mb-3 flex items-center gap-2 text-sm text-text-muted">
              {commenter.avatarUrl && (
                <SafeImg
                  src={commenter.avatarUrl}
                  alt=""
                  className="h-5 w-5 rounded-full"
                  sizes="20px"
                />
              )}
              以{' '}
              <span className="font-medium text-[var(--color-text)]">
                {displayName(commenter.name, commenter.login)}
              </span>{' '}
              的身份评论
            </p>
          ) : (
            <p className="mb-3 text-sm text-text-muted">
              使用 GitHub 登录后即可参与讨论，本站不会读取你的仓库或邮箱。
            </p>
          )}
          <label className="sr-only" htmlFor="article-comment">
            发表评论
          </label>
          <textarea
            id="article-comment"
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
            }}
            maxLength={1000}
            rows={4}
            placeholder="写下你的想法…"
            disabled={!commenter || createComment.isPending}
            className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-text-muted">{content.length}/1000</span>
            {commenter ? (
              <button
                type="submit"
                disabled={!content.trim() || createComment.isPending}
                className="cursor-pointer rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createComment.isPending ? '发布中…' : '发布评论'}
              </button>
            ) : (
              <button
                type="button"
                onClick={startLogin}
                className="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
              >
                使用 GitHub 登录后评论
              </button>
            )}
          </div>
        </form>
        {errorMessage && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 divide-y divide-[var(--color-border-light)]">
          {commentsQuery.isLoading && <p className="py-5 text-sm text-text-muted">评论加载中…</p>}
          {!commentsQuery.isLoading && commentsQuery.data?.length === 0 && (
            <p className="py-5 text-sm text-text-muted">还没有评论，来留下第一条想法吧。</p>
          )}
          {commentsQuery.data?.map((comment) => {
            const canDelete = isAdmin || commenter?.id === comment.author.id
            return (
              <article key={comment.id} className="py-5">
                <div className="flex items-start gap-3">
                  {comment.author.avatarUrl ? (
                    <SafeImg
                      src={comment.author.avatarUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full border border-[var(--color-border-light)]"
                      sizes="36px"
                    />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-full bg-bg-alt" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <a
                        href={comment.author.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[var(--color-text)] hover:text-accent"
                      >
                        {displayName(comment.author.name, comment.author.login)}
                      </a>
                      <span className="text-xs text-text-muted">
                        @{comment.author.login} · {comment.createdAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                      {comment.content}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        void deleteComment.mutateAsync(comment.id)
                      }}
                      disabled={deleteComment.isPending}
                      className="cursor-pointer text-xs text-text-muted hover:text-red-500 disabled:opacity-50"
                    >
                      删除
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
