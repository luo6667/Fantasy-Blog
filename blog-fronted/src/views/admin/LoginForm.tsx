'use client';

import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';

const inputClass =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none transition-colors focus:border-accent';

/**
 * 管理员登录表单（/admin/login）
 *
 * 站点只保留管理员身份：登录成功后写入 token 并返回文章管理页；
 * 已登录管理员访问本页时直接跳转后台。
 */
export default function LoginForm() {
  const router = useRouter();
  const { login, checking, isAdmin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!checking && isAdmin) router.replace('/admin/articles');
  }, [checking, isAdmin, router]);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(username, password);
      router.replace('/admin/articles');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-[var(--color-border-light)] bg-surface p-8">
      <h1 className="mb-1 text-2xl font-bold tracking-[-0.02em]">管理员登录</h1>
      <p className="mb-6 text-sm text-text-muted">登录后可管理文章、主标签、规划与简历内容。</p>

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
