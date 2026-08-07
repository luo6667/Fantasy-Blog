import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import AuthModal from '@/components/auth/AuthModal';
import CommentSection from '@/components/comment/CommentSection';
import { BgOrbs, MdxContent, Reveal, Tag } from '@/components/common';
import {
  useArticleDetailQuery,
  useArticleFavoriteMutation,
  useArticleLikeMutation,
  useDeleteArticleMutation,
} from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { fadeUp, springHero } from '@/lib/motion';

/**
 * 博客文章详情页 /blog/:id
 *
 * 从后端 GET /api/articles/:id 获取正文（MDX），含加载/失败（404）状态。
 * 正文通过 MdxContent 运行时渲染，支持 Markdown / 图片 / 表格等。
 * 管理员登录后显示「编辑 / 删除」按钮。
 */
export default function BlogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const { data: article, isLoading: loading, error } = useArticleDetailQuery(id);
  const deleteArticle = useDeleteArticleMutation();
  const likeArticle = useArticleLikeMutation(id ?? '');
  const favoriteArticle = useArticleFavoriteMutation(id ?? '');
  const errorMessage = error?.message ?? deleteArticle.error?.message;

  /** 删除文章（管理员，确认后返回列表） */
  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('确定删除这篇文章吗？此操作不可恢复。')) return;
    try {
      await deleteArticle.mutateAsync(id);
      void navigate('/blog');
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  /** 未登录时打开登录弹窗 */
  function requireLogin(): boolean {
    if (user) return true;
    setAuthOpen(true);
    return false;
  }

  return (
    <main>
      <BgOrbs />

      <section className="relative z-[1] px-6 py-16">
        <div className="mx-auto max-w-page">
          {/* 加载中 */}
          {loading && <p className="py-12 text-center text-text-muted">文章加载中…</p>}

          {/* 加载失败 / 404 */}
          {!loading && errorMessage && (
            <div className="rounded-lg border border-[var(--color-border-light)] bg-bg-alt p-6">
              <p className="mb-2 font-semibold text-[var(--color-text)]">文章加载失败</p>
              <p className="mb-4 text-sm text-text-muted">{errorMessage}</p>
              <Link
                to="/blog"
                className="text-accent transition-colors hover:opacity-80"
              >
                ← 返回博客列表
              </Link>
            </div>
          )}

          {/* 正文 */}
          {!loading && !errorMessage && article && (
            <Reveal>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <Link
                  to="/blog"
                  className="inline-block text-sm text-text-muted transition-colors hover:text-accent"
                >
                  ← 返回博客列表
                </Link>
                {isAdmin && (
                  <div className="flex gap-2 text-sm">
                    <Link
                      to={`/admin/edit/${article.id}`}
                      className="rounded-md border border-[var(--color-border)] px-3 py-1 transition-colors hover:border-accent hover:text-accent"
                    >
                      编辑
                    </Link>
                    <button
                      type="button"
                      onClick={() => { void handleDelete(); }}
                      className="rounded-md px-3 py-1 text-red-500 transition-colors hover:bg-red-500/10"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
              <article>
                <time className="text-xs text-text-muted">{article.date}</time>
                <motion.h1
                  className="mb-4 text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-[1.15] tracking-[-0.03em]"
                  variants={fadeUp}
                  initial="initial"
                  animate="animate"
                  transition={{ ...springHero, duration: 0.7 }}
                >
                  {article.title}
                </motion.h1>
                {article.excerpt && (
                  <motion.p
                    className="mb-6 max-w-prose text-base leading-[1.8] text-text-muted"
                    variants={fadeUp}
                    initial="initial"
                    animate="animate"
                    transition={{ ...springHero, duration: 0.6, delay: 0.08 }}
                  >
                    {article.excerpt}
                  </motion.p>
                )}
                <div className="mb-8 flex flex-wrap gap-1.5">
                  {article.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>

                {/* 点赞 / 收藏（登录后可操作） */}
                <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
                  <button
                    type="button"
                    disabled={likeArticle.isPending}
                    onClick={() => { if (requireLogin()) likeArticle.mutate(); }}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 transition-colors disabled:opacity-50 ${
                      article.likedByMe
                        ? 'border-red-400/60 bg-red-500/10 text-red-500'
                        : 'border-[var(--color-border)] text-text-muted hover:border-red-400 hover:text-red-500'
                    }`}
                  >
                    <i className={`iconfont2 icon-dianzan ${article.likedByMe ? '' : 'opacity-60'}`} /> 点赞 {String(article.likes)}
                  </button>
                  <button
                    type="button"
                    disabled={favoriteArticle.isPending}
                    onClick={() => { if (requireLogin()) favoriteArticle.mutate(); }}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 transition-colors disabled:opacity-50 ${
                      article.favoritedByMe
                        ? 'border-amber-400/60 bg-amber-500/10 text-amber-500'
                        : 'border-[var(--color-border)] text-text-muted hover:border-amber-400 hover:text-amber-500'
                    }`}
                  >
                    <i className={`iconfont2 icon-shoucangxing ${article.favoritedByMe ? '' : 'opacity-60'}`} /> 收藏 {String(article.favorites)}
                  </button>
                </div>

                {article.cover && (
                  <img
                    src={article.cover}
                    alt=""
                    className="mb-8 w-full rounded-lg border border-[var(--color-border-light)] object-cover"
                    draggable={false}
                  />
                )}
                <MdxContent html={article.contentHtml} />
              </article>

              {/* 评论区 */}
              <CommentSection articleId={article.id} />
            </Reveal>
          )}
        </div>
      </section>

      {/* 登录弹窗（点赞/收藏需登录） */}
      <AuthModal open={authOpen} onClose={() => { setAuthOpen(false); }} />
    </main>
  );
}
