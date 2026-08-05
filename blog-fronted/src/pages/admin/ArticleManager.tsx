import { Link } from 'react-router-dom';

import { useArticleListQuery, useDeleteArticleMutation } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';

const btnGhost =
  'rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent';

const btnDanger = 'rounded-md px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-500/10';

/**
 * 文章管理界面
 *
 * 列表 + 删除（confirm 确认）；
 * 新建/编辑跳转独立编辑器页面（/admin/new、/admin/edit/:id）。
 * 仅管理员可见（父级 Admin/index 保证）。
 */
export default function ArticleManager() {
  const { logout } = useAuth();
  const articleQuery = useArticleListQuery(null);
  const deleteArticle = useDeleteArticleMutation();

  const articles = articleQuery.data?.list ?? [];
  const loading = articleQuery.isLoading;
  const errorMessage = articleQuery.error?.message ?? deleteArticle.error?.message;

  /** 删除文章（确认后执行） */
  async function handleDelete(id: string) {
    if (!window.confirm('确定删除这篇文章吗？其评论将一并删除，此操作不可恢复。')) return;
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
          <h1 className="text-2xl font-bold tracking-[-0.02em]">文章管理</h1>
          <p className="text-sm text-text-muted">共 {String(articles.length)} 篇</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/new"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            + 新建文章
          </Link>
          <button onClick={logout} className={btnGhost}>
            退出登录
          </button>
        </div>
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
                <p className="text-sm text-text-muted">
                  {a.date}
                  {a.tags.length > 0 ? ` · ${a.tags.join(' / ')}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/admin/edit/${a.id}`} className={btnGhost}>
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
