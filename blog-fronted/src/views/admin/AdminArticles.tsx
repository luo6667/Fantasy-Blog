'use client';

import { useArticleListQuery, useTagsQuery } from '@/hooks/queries';

import ArticleManager from './ArticleManager';
import TagManager from './TagManager';

/**
 * 文章管理页（/admin/articles）
 *
 * 概览指标 + 文章列表 + 主标签管理合并为默认页。
 */
export default function AdminArticles() {
  const articlesQuery = useArticleListQuery(null);
  const tagsQuery = useTagsQuery();

  const total = articlesQuery.data?.total ?? 0;
  const tagCount = tagsQuery.data?.length ?? 0;
  const usedTagCount = (tagsQuery.data ?? []).filter((t) => t.count > 0).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">文章管理</h1>
        <p className="mt-1 text-sm text-text-muted">
          新建、编辑、删除文章，并维护每篇文章唯一的主标签。
        </p>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3">
          <p className="text-xs text-text-muted">文章总数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{String(total)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3">
          <p className="text-xs text-text-muted">主标签数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{String(tagCount)}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3 sm:col-span-1">
          <p className="text-xs text-text-muted">使用中的主标签</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{String(usedTagCount)}</p>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <ArticleManager />
        <TagManager />
      </div>
    </div>
  );
}
