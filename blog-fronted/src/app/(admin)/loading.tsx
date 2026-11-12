/**
 * 📘 app/(admin)/loading.tsx —— 后台路由级加载骨架
 *
 * 后台页面多为动态 RSC（需要读 cookies / 实时数据），点击侧栏后先给出结构占位，
 * 避免出现「点了没反应」的空白等待。骨架由 AdminShell 包住，无需重复侧栏。
 */
export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] px-6 py-10 md:px-10" aria-busy="true">
      <div className="h-2.5 w-20 rounded-full bg-[var(--color-border)]" />
      <div className="mt-4 h-8 w-56 rounded-lg bg-[var(--color-border-light)]" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="h-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <div className="h-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <div className="h-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </div>
      <div className="mt-6 h-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
    </div>
  );
}
