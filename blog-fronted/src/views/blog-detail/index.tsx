'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { BgOrbs, MdxContent, SafeImg, Tag } from '@/components/common';
import { useArticleDetailQuery, useDeleteArticleMutation } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { fadeUp, springHero } from '@/lib/motion';
import type { ArticleDetail } from '@/types/api';

/**
 * 博客文章详情页 /blog/:id
 *
 * 正文优先来自 page.tsx 服务端 SSG 预渲染的 initialArticle（首屏直出，不发请求）；
 * 无 initialArticle（构建期后端不可用等降级场景）时由 useArticleDetailQuery
 * 客户端加载，含加载 / 失败（404）状态。
 * 正文通过 MdxContent 运行时渲染，支持 Markdown / 图片 / 表格等。
 * 标签区展示唯一主标签与自由子标签；管理员登录后显示「编辑 / 删除」按钮。
 */
export default function BlogDetail({
  initialArticle = null,
}: {
  initialArticle?: ArticleDetail | null;
}) {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { isAdmin } = useAuth();

  const { data: article, isLoading: loading, error } = useArticleDetailQuery(id, initialArticle);
  const deleteArticle = useDeleteArticleMutation();
  const errorMessage = error?.message ?? deleteArticle.error?.message;

  /** 删除文章（管理员，确认后返回列表） */
  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('确定删除这篇文章吗？此操作不可恢复。')) return;
    try {
      await deleteArticle.mutateAsync(id);
      router.push('/blog');
    } catch {
      /* 错误已通过 errorMessage 展示 */
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
          {!loading && errorMessage && (
            <div className="rounded-lg border border-[var(--color-border-light)] bg-bg-alt p-6">
              <p className="mb-2 font-semibold text-[var(--color-text)]">文章加载失败</p>
              <p className="mb-4 text-sm text-text-muted">{errorMessage}</p>
              <Link
                href="/blog"
                className="text-accent transition-colors hover:opacity-80"
              >
                ← 返回博客列表
              </Link>
            </div>
          )}

          {/* 正文 */}
          {!loading && !errorMessage && article && (
            <div>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/blog"
                  className="inline-block text-sm text-text-muted transition-colors hover:text-accent"
                >
                  ← 返回博客列表
                </Link>
                {isAdmin && (
                  <div className="flex gap-2 text-sm">
                    <Link
                      href={`/admin/edit/${article.id}`}
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
                <div className="mb-8 flex flex-wrap items-center gap-1.5">
                  <Tag variant="accent">{article.primaryTag.name}</Tag>
                  {article.subTags.map((t) => (
                    <Tag key={t} variant="outline">
                      {t}
                    </Tag>
                  ))}
                </div>

                {article.cover && (
                  <SafeImg
                    src={article.cover}
                    alt={article.title}
                    priority
                    sizes="(max-width: 860px) 100vw, 860px"
                    className="mb-8 aspect-video w-full rounded-lg border border-[var(--color-border-light)]"
                  />
                )}
                <MdxContent html={article.contentHtml} />
              </article>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
