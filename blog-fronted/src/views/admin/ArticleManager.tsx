import Link from 'next/link';

import { useArticleListQuery, useDeleteArticleMutation } from '@/hooks/queries';

const btnGhost =
  'rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent';

const btnDanger = 'rounded-md px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10';

/**
 * 文章管理界面
 *
 * 列表 + 删除（confirm 确认）；
 * 新建/编辑跳转独立编辑器页面（/admin/new、/admin/edit/:id）。
 */
export default function ArticleManager() {
  const articleQuery = useArticleListQuery(null);
  const deleteArticle = useDeleteArticleMutation();

  const articles = articleQuery.data?.list ?? [];
  const loading = articleQuery.isLoading;
  const errorMessage = articleQuery.error?.message ?? deleteArticle.error?.message;

  /** 删除文章（确认后执行） */
  async function handleDelete(id: string) {
    if (!window.confirm('确定删除这篇文章吗？此操作不可恢复。')) return;
    try {
      await deleteArticle.mutateAsync(id);
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em]">文章列表</h2>
          <p className="text-sm text-text-muted">共 {String(articles.length)} 篇</p>
        </div>
        <Link
          href="/admin/new"
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          + 新建文章
        </Link>
      </div>

      {errorMessage && <p className="mb-4 text-sm text-red-500">{errorMessage}</p>}

      {loading ? (
        <p className="py-8 text-center text-text-muted">加载中…</p>
      ) : articles.length === 0 ? (
        <p className="py-8 text-center text-text-muted">暂无文章，点击「新建文章」发布第一篇。</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-light)]">
          {articles.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{a.title}</h3>
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
                  <span>{a.date}</span>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                    {a.primaryTag.name}
                  </span>
                  {a.subTags.length > 0 && (
                    <span className="truncate text-xs text-text-muted">
                      {a.subTags.join(' / ')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/admin/edit/${a.id}`} className={btnGhost}>
                  编辑
                </Link>
                <button onClick={() => { void handleDelete(a.id); }} className={btnDanger}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
