import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BgOrbs } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';

import ArticleManager from './ArticleManager';
import SiteContentManager from './content';
import LoginForm from './LoginForm';
import TagManager from './TagManager';
import UserPanel from './UserPanel';

type AdminTab = 'user' | 'admin';

const tabBase =
  'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors';
const tabIdle =
  'border border-[var(--color-border)] text-text-muted hover:border-accent hover:text-accent';
const tabActive = 'border-transparent bg-accent font-semibold text-white';

/**
 * 管理页 /admin
 *
 * 管理员登录后直接进入管理员模式（隐藏「用户 / 管理员」tab，无需用户模式）；
 * 未登录 / 普通用户访问时保留两个 tab：
 * - 用户：无需登录，浏览博客文章与分类标签
 * - 管理员：仅管理员（admin / 123456）可管理文章与标签；普通用户访问提示无权限
 *
 * 兼容旧链接：?new=1 / ?edit=:id 自动跳转到独立编辑器页面。
 */
export default function Admin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAdmin, checking, logout } = useAuth();
  // 管理员登录或有 ?new= / ?edit= 参数时默认进入管理员 tab
  const hasArticleAction = searchParams.get('new') === '1' || Boolean(searchParams.get('edit'));
  const [tab, setTab] = useState<AdminTab>(isAdmin || hasArticleAction ? 'admin' : 'user');

  // 旧链接 ?new=1 / ?edit=:id → 跳转独立编辑器页面
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      void navigate('/admin/new', { replace: true });
    } else {
      const editId = searchParams.get('edit');
      if (editId) void navigate(`/admin/edit/${editId}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <main>
      <BgOrbs />
      <section className="relative z-[1] px-6 py-16">
        <div className="mx-auto max-w-page">
          {/* 标题 + tab 切换（管理员登录后隐藏 tab，默认即管理员模式） */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-[-0.02em]">管理</h1>
            {!isAdmin && (
              <div className="flex gap-2" role="tablist" aria-label="管理模式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'user'}
                  onClick={() => { setTab('user'); }}
                  className={`${tabBase} ${tab === 'user' ? tabActive : tabIdle}`}
                >
                  用户
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'admin'}
                  onClick={() => { setTab('admin'); }}
                  className={`${tabBase} ${tab === 'admin' ? tabActive : tabIdle}`}
                >
                  管理员
                </button>
              </div>
            )}
          </div>

          {/* 管理员登录 → 直接进入管理员模式，文章管理 + 标签管理 + 简历/首页内容管理 */}
          {isAdmin ? (
            <>
              <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
                <ArticleManager />
                <TagManager />
              </div>
              <div className="mt-12 border-t border-[var(--color-border-light)] pt-10">
                <SiteContentManager />
              </div>
            </>
          ) : tab === 'user' ? (
            <UserPanel />
          ) : (
            <div>
              {checking && <p className="py-12 text-center text-text-muted">校验登录状态…</p>}

              {/* 未登录 → 管理员登录表单 */}
              {!checking && !user && <LoginForm />}

              {/* 普通用户登录 → 无权限提示 */}
              {!checking && user && (
                <div className="mx-auto max-w-md rounded-lg border border-[var(--color-border-light)] bg-bg-alt p-8 text-center">
                  <p className="mb-2 text-lg font-semibold">需要管理员权限</p>
                  <p className="mb-6 text-sm text-text-muted">
                    当前登录的是普通用户「{user.username}」，只有管理员才能管理文章与标签。
                  </p>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    退出当前账号
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
