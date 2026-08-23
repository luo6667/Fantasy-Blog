import { motion } from 'motion/react';
import { type SyntheticEvent, useState } from 'react';

import AuthModal from '@/components/auth/AuthModal';
import {
  useCommentsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useLikeCommentMutation,
  useReplyCommentMutation,
} from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import type { CommentItem } from '@/types/api';

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-accent';

const btnGhost =
  'cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent';

const btnPrimary =
  'cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';

/** 回复折叠阈值：超过 5 条折叠，仅展示前 3 条 */
const REPLY_COLLAPSE_THRESHOLD = 5;
const REPLY_PREVIEW_COUNT = 3;

/** 格式化时间：YYYY-MM-DD HH:mm */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 构建 parentId → 回复列表 的映射（一次 O(n) 遍历，供各条一级评论复用） */
function buildRepliesMap(comments: CommentItem[]): Map<string, CommentItem[]> {
  const childrenOf = new Map<string, CommentItem[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const arr = childrenOf.get(c.parentId) ?? [];
    arr.push(c);
    childrenOf.set(c.parentId, arr);
  }
  return childrenOf;
}

/** 从映射中收集某条一级评论的所有后代回复（BFS，扁平，按时间升序） */
function collectReplies(rootId: string, childrenOf: Map<string, CommentItem[]>): CommentItem[] {
  const result: CommentItem[] = [];
  const queue = [...(childrenOf.get(rootId) ?? [])];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const c = queue.shift();
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    result.push(c);
    queue.push(...(childrenOf.get(c.id) ?? []));
  }
  result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return result;
}

interface CommentSectionProps {
  articleId: string;
}

/**
 * 文章评论区
 *
 * - 评论与所有层级回复公开可见
 * - 发表评论 / 回复 / 点赞需登录（普通用户或管理员均可）
 * - 回复支持无限嵌套，但统一平铺渲染在第二层级，标注「谁回复谁」
 * - 某条评论的回复超过 5 条时折叠，仅展示前 3 条，可展开
 * - 删除：作者本人或管理员（连带删除其全部子孙回复）
 */
export default function CommentSection({ articleId }: CommentSectionProps) {
  const { user, isAdmin } = useAuth();
  const userId = user?.id;
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [authOpen, setAuthOpen] = useState(false);

  const {
    data: comments = [],
    isLoading: loading,
    error: loadError,
  } = useCommentsQuery(articleId, userId);

  const createComment = useCreateCommentMutation(articleId, userId);
  const replyComment = useReplyCommentMutation(articleId, userId);
  const likeComment = useLikeCommentMutation(articleId, userId);
  const deleteComment = useDeleteCommentMutation(articleId, userId);

  const submitting = createComment.isPending || replyComment.isPending;
  const errorMessage =
    loadError?.message ??
    createComment.error?.message ??
    replyComment.error?.message ??
    likeComment.error?.message ??
    deleteComment.error?.message;

  /** 发表评论 */
  async function handleComment(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const content = commentText.trim();
    if (!content) return;
    try {
      await createComment.mutateAsync(content);
      setCommentText('');
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  /** 发表回复（可回复任意评论/回复） */
  const handleReply = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!replyTarget) return;
    const content = replyText.trim();
    if (!content) return;
    replyComment
      .mutateAsync({ commentId: replyTarget, content })
      .then(() => {
        setReplyTarget(null);
        setReplyText('');
      })
      .catch(() => {
        /* 错误已通过 errorMessage 展示 */
      });
  };

  /** 展开 / 收起某条评论的回复 */
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** 切换某条评论的回复框 */
  const handleReplyToggle = (id: string) => {
    setReplyTarget((prev) => (prev === id ? null : id));
    setReplyText('');
  };

  /** 点赞 / 取消点赞 */
  const handleLike = (comment: CommentItem) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    likeComment.mutate(comment.id);
  };

  /** 删除评论（作者本人或管理员，连带全部子孙回复） */
  const handleDelete = (comment: CommentItem) => {
    if (!window.confirm('确定删除这条评论吗？其全部回复将一并删除，此操作不可恢复。')) return;
    deleteComment.mutateAsync(comment.id).catch(() => {
      /* 错误已通过 errorMessage 展示 */
    });
  };

  // 父 → 回复映射与一级评论列表（React Compiler 自动记忆化）
  const repliesMap = buildRepliesMap(comments);
  const topLevel = comments.filter((c) => !c.parentId);

  return (
    <section className="mt-12 border-t border-[var(--color-border-light)] pt-8">
      <h2 className="mb-6 text-xl font-bold tracking-[-0.02em]">
        评论 <span className="text-sm font-normal text-text-muted">({String(comments.length)})</span>
      </h2>

      {errorMessage && <p className="mb-4 text-sm text-red-500">{errorMessage}</p>}

      {/* 评论输入 */}
      {user ? (
        <form onSubmit={(e) => { void handleComment(e); }} className="mb-8 flex flex-col gap-2">
          <textarea
            className={`${inputClass} min-h-[5.5rem] resize-y leading-relaxed`}
            value={commentText}
            onChange={(e) => { setCommentText(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={`以 ${user.username} 的身份发表评论…（Enter 发送，Shift+Enter 换行）`}
            maxLength={1000}
          />
          <div className="flex justify-end">
            <button type="submit" disabled={submitting || !commentText.trim()} className={btnPrimary}>
              {submitting ? '提交中…' : '发表评论'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 rounded-lg border border-dashed border-[var(--color-border)] bg-bg-alt/50 px-4 py-6 text-center">
          <p className="mb-3 text-sm text-text-muted">登录后即可发表评论、回复与点赞</p>
          <button
            type="button"
            onClick={() => { setAuthOpen(true); }}
            className={btnPrimary}
          >
            登录 / 注册
          </button>
        </div>
      )}

      {/* 评论列表 */}
      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted">评论加载中…</p>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">还没有评论，来抢沙发吧～</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {topLevel.map((c) => {
            const allReplies = collectReplies(c.id, repliesMap);
            const expanded = expandedIds.has(c.id);
            const visible = allReplies.length > REPLY_COLLAPSE_THRESHOLD && !expanded
              ? allReplies.slice(0, REPLY_PREVIEW_COUNT)
              : allReplies;
            const hiddenCount = allReplies.length - visible.length;
            const replying = replyTarget === c.id;

            return (
              <li key={c.id}>
                {/* 一级评论 */}
                <CommentCard
                  comment={c}
                  canDelete={isAdmin || c.mine}
                  replying={replying}
                  replyText={replying ? replyText : ''}
                  submitting={submitting}
                  onReplyToggle={handleReplyToggle}
                  onReplyChange={setReplyText}
                  onReplySubmit={handleReply}
                  onLike={handleLike}
                  onDelete={handleDelete}
                />

                {/* 全部回复平铺在第二层级（谁回复谁标注） */}
                {allReplies.length > 0 && (
                  <ul className="ml-6 mt-3 flex flex-col gap-3 border-l border-[var(--color-border-light)] pl-4">
                    {visible.map((r) => (
                      <li key={r.id}>
                        <CommentCard
                          comment={r}
                          canDelete={isAdmin || r.mine}
                          isReply
                          replying={replyTarget === r.id}
                          replyText={replyTarget === r.id ? replyText : ''}
                          submitting={submitting}
                          onReplyToggle={handleReplyToggle}
                          onReplyChange={setReplyText}
                          onReplySubmit={handleReply}
                          onLike={handleLike}
                          onDelete={handleDelete}
                        />
                      </li>
                    ))}

                    {/* 折叠：展开/收起 */}
                    {hiddenCount > 0 && (
                      <li>
                        <button
                          type="button"
                          onClick={() => { toggleExpand(c.id); }}
                          className="cursor-pointer rounded-md border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
                        >
                          {expanded ? '收起回复' : `展开全部回复（还有 ${String(hiddenCount)} 条）`}
                        </button>
                      </li>
                    )}
                    {expanded && allReplies.length > REPLY_COLLAPSE_THRESHOLD && (
                      <li>
                        <button
                          type="button"
                          onClick={() => { toggleExpand(c.id); }}
                          className="cursor-pointer rounded-md border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
                        >
                          收起回复
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AuthModal open={authOpen} onClose={() => { setAuthOpen(false); }} />
    </section>
  );
}

/** 单条评论/回复卡片（React Compiler 自动记忆化） */
function CommentCard({
  comment,
  canDelete,
  isReply = false,
  replying = false,
  replyText = '',
  submitting = false,
  onReplyToggle,
  onReplyChange,
  onReplySubmit,
  onLike,
  onDelete,
}: {
  comment: CommentItem;
  canDelete: boolean;
  isReply?: boolean;
  replying?: boolean;
  replyText?: string;
  submitting?: boolean;
  onReplyToggle: (id: string) => void;
  onReplyChange: (v: string) => void;
  onReplySubmit: (e: SyntheticEvent<HTMLFormElement>) => void;
  onLike: (comment: CommentItem) => void;
  onDelete: (comment: CommentItem) => void;
}) {
  const isAdminAuthor = comment.authorType === 'admin';
  return (
    <motion.div
      className="rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {comment.authorName}
        </span>
        {isAdminAuthor && (
          <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-semibold text-accent">
            管理员
          </span>
        )}
        {isReply && comment.replyToName && (
          <span className="text-xs text-text-muted">
            回复了 <span className="font-medium text-text-secondary">{comment.replyToName}</span>
          </span>
        )}
        <span className="text-xs text-text-muted">{formatTime(comment.createdAt)}</span>
      </div>

      <p className="mb-2 whitespace-pre-wrap text-sm leading-[1.8] text-[var(--color-text)]">
        {comment.content}
      </p>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => { onLike(comment); }}
          className={`cursor-pointer rounded-full border px-2.5 py-1 transition-colors ${
            comment.likedByMe
              ? 'border-red-400/60 bg-red-500/10 text-red-500'
              : 'border-[var(--color-border)] text-text-muted hover:border-red-400 hover:text-red-500'
          }`}
        >
          {comment.likedByMe ? '❤' : '🤍'} {String(comment.likes)}
        </button>

        {/* 评论与回复均可再回复（无限嵌套，前端扁平渲染） */}
        <button type="button" onClick={() => { onReplyToggle(comment.id); }} className={btnGhost}>
          {replying ? '取消' : '回复'}
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={() => { onDelete(comment); }}
            className="cursor-pointer rounded-md px-2.5 py-1 text-red-500 transition-colors hover:bg-red-500/10"
          >
            删除
          </button>
        )}
      </div>

      {/* 回复输入框 */}
      {replying && (
        <form onSubmit={(e) => { onReplySubmit(e); }} className="mt-3 flex flex-col gap-2">
          <textarea
            className={`${inputClass} min-h-[4rem] resize-y leading-relaxed`}
            value={replyText}
            onChange={(e) => { onReplyChange(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={`回复 ${comment.authorName}…（Enter 发送，Shift+Enter 换行）`}
            maxLength={1000}
            autoFocus
          />
          <div className="flex justify-end">
            <button type="submit" disabled={submitting || !replyText.trim()} className={btnPrimary}>
              {submitting ? '提交中…' : '发表回复'}
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}
