import { motion } from 'motion/react';
import { type SyntheticEvent,useEffect,useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/api';

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none transition-colors focus:border-accent';

const tabBase =
  'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors';
const tabIdle =
  'border border-[var(--color-border)] text-text-muted hover:border-accent hover:text-accent';
const tabActive = 'border-transparent bg-accent font-semibold text-white';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 登录 / 注册弹窗
 *
 * - 登录：可选择「普通用户 / 管理员」身份
 * - 注册：仅普通用户（账号 + 密码）
 * 由导航栏「请登录」与评论区「登录后评论」触发。
 */
export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 每次打开时重置为登录表单，避免残留上次状态
  useEffect(() => {
    if (open) {
      setMode('login');
      setRole('user');
      setUsername('');
      setPassword('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(role, username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
      setUsername('');
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? '登录' : '注册'}
    >
      <motion.div
        className="w-full max-w-sm rounded-xl border border-[var(--color-border-light)] bg-surface p-6 shadow-xl"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => { e.stopPropagation(); }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-[-0.02em]">
            {mode === 'login' ? '登录' : '注册'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-text-muted transition-colors hover:bg-bg-alt hover:text-[var(--color-text)]"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* 模式切换：登录 / 注册 */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`${tabBase} ${mode === 'login' ? tabActive : tabIdle}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`${tabBase} ${mode === 'register' ? tabActive : tabIdle}`}
          >
            注册
          </button>
        </div>

        {/* 登录身份选择（注册仅普通用户） */}
        {mode === 'login' && (
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => { setRole('user'); setError(''); }}
              className={`${tabBase} text-xs ${role === 'user' ? tabActive : tabIdle}`}
            >
              普通用户
            </button>
            <button
              type="button"
              onClick={() => { setRole('admin'); setError(''); }}
              className={`${tabBase} text-xs ${role === 'admin' ? tabActive : tabIdle}`}
            >
              管理员
            </button>
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-muted">账号</span>
            <input
              className={inputClass}
              value={username}
              onChange={(e) => { setUsername(e.target.value); }}
              required
              autoComplete={mode === 'login' ? 'username' : 'new-username'}
              minLength={mode === 'register' ? 2 : 1}
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 6 : 1}
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? '提交中…'
              : mode === 'login'
                ? (role === 'admin' ? '管理员登录' : '登录')
                : '注册并登录'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-text-muted">
          {mode === 'login' ? (
            <>还没有账号？{' '}
              <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => { setMode('register'); setError(''); }}>
                去注册
              </button>
            </>
          ) : (
            <>已有账号？{' '}
              <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => { setMode('login'); setError(''); }}>
                去登录
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}

