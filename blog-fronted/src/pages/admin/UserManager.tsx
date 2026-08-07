import { useDeleteUserMutation, useUsersManageQuery } from '@/hooks/queries';

const btnDanger =
  'cursor-pointer rounded-md px-2.5 py-1 text-xs text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50';

/**
 * 用户管理（管理员）
 *
 * 用户列表 + 统计（注册时间 / 评论数 / 收藏文章数），
 * 删除用户会级联清理其评论、通知、私信会话（后端处理）。
 */
export default function UserManager() {
  const { data: users = [], isLoading, error } = useUsersManageQuery();
  const deleteUser = useDeleteUserMutation();

  async function handleDelete(id: string, username: string) {
    if (
      !window.confirm(
        `确定删除用户「${username}」吗？其评论、通知、私信会话将一并删除，此操作不可恢复。`,
      )
    ) {
      return;
    }
    try {
      await deleteUser.mutateAsync(id);
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  const errorMessage = error?.message ?? deleteUser.error?.message;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.05em] text-text-muted">
        用户管理
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        共 {String(users.length)} 位注册用户；删除将连带清理其评论、通知与私信会话。
      </p>

      {errorMessage && <p className="mb-4 text-sm text-red-500">{errorMessage}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-text-muted">加载中…</p>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">暂无注册用户</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border-light)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-left text-xs text-text-muted">
                <th className="px-4 py-2.5 font-medium">用户名</th>
                <th className="px-4 py-2.5 font-medium">注册时间</th>
                <th className="px-4 py-2.5 text-center font-medium">评论数</th>
                <th className="px-4 py-2.5 text-center font-medium">收藏数</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--color-border-light)] last:border-b-0 hover:bg-bg-alt/50"
                >
                  <td className="px-4 py-2.5 font-medium">{u.username}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {new Date(u.createdAt).toLocaleString('zh-CN', { hour12: false })}
                  </td>
                  <td className="px-4 py-2.5 text-center">{String(u.commentCount)}</td>
                  <td className="px-4 py-2.5 text-center">{String(u.favoriteCount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => { void handleDelete(u.id, u.username); }}
                      disabled={deleteUser.isPending}
                      className={btnDanger}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
