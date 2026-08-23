import { type SyntheticEvent,useState } from 'react';

import { useAuth } from '@/hooks/useAuth';

const inputClass =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none transition-colors focus:border-accent';

/**
 * 管理登录表单（/admin 管理员 tab）
 *
 * 固定以管理员身份登录（admin / 123456），
 * 成功后由 authStore 更新登录态，父级自动切换到管理界面。
 */
export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login('admin', username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-[var(--color-border-light)] bg-surface p-8">
      <h1 className="mb-1 text-2xl font-bold tracking-[-0.02em]">管理登录</h1>
      <p className="mb-6 text-sm text-text-muted">以管理员身份登录后管理博客文章与标签</p>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-muted">账号</span>
          <input
            className={inputClass}
            value={username}
            onChange={(e) => { setUsername(e.target.value); }}
            required
            autoComplete="username"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-muted">密码</span>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => { setPassword(e.target.value); }}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}
