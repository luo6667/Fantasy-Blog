import Link from 'next/link';

import { Tag } from '@/components/common';
import { useArticleListQuery, useTagsQuery } from '@/hooks/queries';

/**
 * 用户面板（/admin 的「用户」tab）
 *
 * 无需登录即可浏览：
 * - 博客文章列表（点击跳转详情）
 * - 分类标签一览（含文章数）
 */
export default function UserPanel() {
  const articleQuery = useArticleListQuery(null);
  const tagsQuery = useTagsQuery();

  const articles = articleQuery.data?.list ?? [];
  const tags = tagsQuery.data ?? [];
  const loading = articleQuery.isLoading || tagsQuery.isLoading;
  const errorMessage = articleQuery.error?.message ?? tagsQuery.error?.message;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-[-0.02em]">用户模式</h1>
      <p className="mb-6 text-sm text-text-muted">
        无需登录即可浏览博客文章与分类标签，点击文章可查看详情。
      </p>

      {errorMessage && <p className="mb-4 text-sm text-red-500">{errorMessage}</p>}

      {loading ? (
        <p className="py-8 text-center text-text-muted">加载中…</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-[1fr_15rem]">
          {/* 文章列表（只读） */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.05em] text-text-muted">
              文章（{String(articles.length)}）
            </h2>
            {articles.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">暂无文章。</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-light)]">
                {articles.map((a) => (
                  <li key={a.id} className="py-3">
                    <Link
                      href={`/blog/${a.id}`}
                      className="group block transition-colors hover:text-accent"
                    >
                      <span className="mb-0.5 block text-[0.8125rem] font-semibold leading-snug group-hover:underline">
                        {a.title}
                      </span>
                      <span className="block text-xs text-text-muted">
                        {a.date} · {a.excerpt}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {a.tags.map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 标签一览 */}
          <aside>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.05em] text-text-muted">
              分类标签
            </h2>
            {tags.length === 0 ? (
              <p className="text-sm text-text-muted">暂无标签。</p>
            ) : (
              <ul className="flex flex-wrap gap-2 md:flex-col md:items-start">
                {tags.map((t) => (
                  <li key={t.id} className="flex items-center gap-1.5 text-sm">
                    <span className="text-text-secondary">{t.name}</span>
                    <span className="rounded-full bg-accent-soft px-1.5 text-[0.6875rem] text-accent">
                      {t.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
