import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import CommentSection from '@/components/comment/CommentSection';
import { BgOrbs, MdxContent, Reveal, Tag } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { articleApi } from '@/lib/api';
import { fadeUp, springHero } from '@/lib/motion';
import type { ArticleDetail } from '@/types/api';

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
  const { isAdmin } = useAuth();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    articleApi
      .detail(id)
      .then((data) => {
        if (!cancelled) setArticle(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** 删除文章（管理员，确认后返回列表） */
  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('确定删除这篇文章吗？此操作不可恢复。')) return;
    try {
      await articleApi.remove(id);
      void navigate('/blog');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main>
      <BgOrbs />

      <section className="relative z-[1] px-6 py-16">
        <div className="mx-auto max-w-page">
          {/* 加载中 */}
          {loading && <p className="py-12 text-center text-text-muted">文章加载中…</p>}

          {/* 加载失败 / 404 */}
          {!loading && error && (
            <div className="rounded-lg border border-[var(--color-border-light)] bg-bg-alt p-6">
              <p className="mb-2 font-semibold text-[var(--color-text)]">文章加载失败</p>
              <p className="mb-4 text-sm text-text-muted">{error}</p>
              <Link
                to="/blog"
                className="text-accent transition-colors hover:opacity-80"
              >
                ← 返回博客列表
              </Link>
            </div>
          )}

          {/* 正文 */}
          {!loading && !error && article && (
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
                <div className="mb-8 flex flex-wrap gap-1.5">
                  {article.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
                {article.cover && (
                  <img
                    src={article.cover}
                    alt=""
                    className="mb-8 w-full rounded-lg border border-[var(--color-border-light)] object-cover"
                    draggable={false}
                  />
                )}
                <MdxContent mdx={article.content} />
              </article>

              {/* 评论区 */}
              <CommentSection articleId={article.id} />
            </Reveal>
          )}
        </div>
      </section>
    </main>
  );
}
