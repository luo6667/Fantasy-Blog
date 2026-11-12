/**
 * 📘 app/(site)/loading.tsx —— 路由级加载骨架
 *
 * 导航到尚未预取/正在服务端渲染的页面时，App Router 会先展示这个骨架，
 * 让点击立刻有反馈（而不是停在旧页面上等待）。
 * 只做静态色块、不做动画，且保持最小高度避免 CLS。
 */
export default function SiteLoading() {
  return (
    <div className="mx-auto min-h-[70vh] w-full max-w-page px-6 pt-24" aria-busy="true">
      <div className="h-2.5 w-24 rounded-full bg-[var(--color-border)]" />
      <div className="mt-6 h-12 w-3/4 max-w-[26rem] rounded-lg bg-[var(--color-border-light)]" />
      <div className="mt-4 h-4 w-2/3 max-w-[30rem] rounded bg-[var(--color-border-light)]" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <div className="h-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </div>
    </div>
  );
}
