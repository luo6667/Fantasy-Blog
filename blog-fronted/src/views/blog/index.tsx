'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { BgOrbs, CursorGlow, SafeImg, Tag } from '@/components/common';
import {
  useArticleListInfiniteQuery,
  useDeleteArticleMutation,
  useTagsQuery,
} from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { fadeUp, springHero } from '@/lib/motion';
import type { ArticleListItem, PaginatedResult, TagItem } from '@/types/api';

/**
 * 博客列表页
 *
 * 首屏数据由 page.tsx（SSG）预渲染后经 props 注入：initialArticles 为第一页文章、
 * initialTags 为标签计数——无搜索/筛选时直接展示，不发网络请求；
 * 搜索、标签筛选、无限滚动是动态交互，仍由客户端 React Query 走
 * GET /api/articles（分页 + 标签筛选 + 关键字搜索）。
 * 包含加载中 / 加载失败 / 空列表三种状态。
 *
 * 管理员登录后显示「写文章 / 编辑 / 删除」操作按钮。
 */
export default function Blog({
  initialArticles,
  initialTags,
}: {
  initialArticles?: PaginatedResult<ArticleListItem> | null;
  initialTags?: TagItem[] | null;
}) {
  const { isAdmin } = useAuth();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // 搜索防抖：停止输入 400ms 后自动搜索；回车立即搜索
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);
    return () => { window.clearTimeout(timer); };
  }, [searchInput]);

  // 仅无搜索/无筛选时预填 SSG 首屏数据；一旦搜索/切标签，query key 变化，走正常客户端 fetch
  const articleQuery = useArticleListInfiniteQuery(
    activeTag,
    search,
    !activeTag && !search ? initialArticles : null,
  );
  const { data: tags = [] } = useTagsQuery(initialTags);
  const deleteArticle = useDeleteArticleMutation();

  // 无限分页：合并所有已加载页；每页 10 篇
  const articles = articleQuery.data?.pages.flatMap((p) => p.list) ?? [];
  const total = articleQuery.data?.pages[0]?.total ?? 0;
  const loading = articleQuery.isLoading;
  const errorMessage = articleQuery.error?.message ?? deleteArticle.error?.message;

  /** 删除文章（管理员，确认后执行） */
  async function handleDelete(id: string) {
    if (!window.confirm('确定删除这篇文章吗？此操作不可恢复。')) return;
    try {
      await deleteArticle.mutateAsync(id);
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  const pillBase =
    'rounded-full border px-3 py-1 text-[0.8125rem] transition-colors';
  const pillIdle =
    'border-[var(--color-border)] text-text-muted hover:border-accent hover:text-accent';
  const pillActive = 'border-transparent bg-accent font-semibold text-[var(--color-on-accent)]';

  return (
    <main>
      <BgOrbs />

      {/* Hero — 类首页风格 */}
      <section className="relative z-[1] overflow-hidden px-6 pb-10 pt-16">
        <CursorGlow className="z-0" opacity={0.05} />
        <div className="relative z-[1] mx-auto max-w-page">
          <motion.p
            className="mb-3 text-[0.8125rem] font-medium uppercase tracking-[0.05em] text-accent"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, opacity: { duration: 0.2 } }}
          >
            Articles &amp; Insights
          </motion.p>

          <motion.h1
            className="mb-4 text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.05em]"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, opacity: { duration: 0.2 }, delay: 0.08 }}
          >
            <span className="text-accent">Blog</span>
          </motion.h1>

          <motion.p
            className="mb-2 max-w-md text-base leading-[1.6] text-text-muted"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, opacity: { duration: 0.2 }, delay: 0.18 }}
          >
            记录学习过程与工程实践的思考
          </motion.p>

          <motion.p
            className="text-[0.8125rem] text-text-muted/60"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, opacity: { duration: 0.2 }, delay: 0.24 }}
          >
            {loading ? '加载中…' : `共 ${String(total)} 篇文章 · 持续更新中`}
          </motion.p>
        </div>
      </section>

      <section className="relative z-[1] px-6 py-12">
        <div className="mx-auto max-w-page">
          {/* 搜索框：防抖自动搜索 + 回车立即搜索 */}
          <div className="mb-6">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearch(searchInput.trim());
              }}
              placeholder="🔍 搜索文章标题、摘要或正文…（输入后自动搜索，或按回车）"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>

          {/* 标签筛选栏 + 写文章（管理员） */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setActiveTag(null); }}
                className={`${pillBase} ${activeTag === null ? pillActive : pillIdle}`}
              >
                全部
              </button>
              {tags.map((t) => {
                const active = activeTag === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => { setActiveTag(active ? null : t.name); }}
                    className={`${pillBase} ${active ? pillActive : pillIdle}`}
                  >
                    {t.name}
                    <span className={`ml-1 ${active ? 'text-white/70' : 'text-text-muted/60'}`}>
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {isAdmin && (
              <Link
                href="/admin/new"
                className="shrink-0 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-[var(--color-on-accent)] transition-opacity hover:opacity-90"
              >
                + 写文章
              </Link>
            )}
          </div>

          {/* 加载中 */}
          {loading && <p className="py-8 text-center text-text-muted">文章加载中…</p>}

          {/* 加载失败 */}
          {!loading && errorMessage && (
            <div className="rounded-lg border border-[var(--color-border-light)] bg-bg-alt p-6">
              <p className="mb-1 font-semibold text-[var(--color-text)]">文章加载失败</p>
              <p className="text-sm text-text-muted">{errorMessage}</p>
            </div>
          )}

          {/* 空列表 */}
          {!loading && !errorMessage && articles.length === 0 && (
            <p className="py-8 text-center text-text-muted">
              {search ? `没有找到与「${search}」相关的文章。` : '暂无文章，敬请期待。'}
            </p>
          )}

          {/* 文章列表 */}
          {articles.map((post) => (
            <motion.article
              key={post.id}
              className="group border-b border-[var(--color-border-light)] py-5 last:border-b-0"
              initial={false}
              whileHover={{ x: 6, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
            >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <time className="mb-1 block text-xs text-text-muted">{post.date}</time>
                    {/* 标题 + 右侧小封面图（紧挨标题） */}
                    <div className="flex items-start gap-3">
                      <Link href={`/blog/${post.id}`}>
                        <h3 className="mb-1 text-[1.0625rem] font-semibold tracking-[-0.02em] transition-colors duration-200 group-hover:text-accent">
                          {post.title}
                        </h3>
                      </Link>
                      {post.cover && (
                        <Link
                          href={`/blog/${post.id}`}
                          className="shrink-0"
                          aria-label={post.title}
                        >
                          <SafeImg
                            src={post.cover}
                            alt={post.title}
                            sizes="80px"
                            className="h-14 w-20 rounded-lg border border-[var(--color-border-light)] transition-transform duration-300 group-hover:scale-105"
                          />
                        </Link>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1.5 text-xs">
                      <Link
                        href={`/admin/edit/${post.id}`}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 transition-colors hover:border-accent hover:text-accent"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => { void handleDelete(post.id); }}
                        className="rounded-md px-2.5 py-1 text-red-500 transition-colors hover:bg-red-500/10"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
                <p className="mb-2 text-[0.8125rem] leading-[1.5] text-text-muted">
                  {post.excerpt}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag variant="accent" hoverY={-1}>
                    {post.primaryTag.name}
                  </Tag>
                  {post.subTags.map((t) => (
                    <Tag key={t} variant="outline" hoverY={-1}>
                      {t}
                    </Tag>
                  ))}
                </div>
              </motion.article>
          ))}

          {/* 加载更多（还有下一页时显示） */}
          {articleQuery.hasNextPage && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => { void articleQuery.fetchNextPage(); }}
                disabled={articleQuery.isFetchingNextPage}
                className="cursor-pointer rounded-md border border-[var(--color-border)] px-6 py-2 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {articleQuery.isFetchingNextPage ? '加载中…' : `加载更多（已加载 ${String(articles.length)}/${String(total)}）`}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
