import { type SyntheticEvent, useState } from 'react';

import { useCreateTagMutation, useDeleteTagMutation, useTagsQuery } from '@/hooks/queries';
import type { TagItem } from '@/types/api';

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-accent';

const btnGhost =
  'rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent';

/**
 * 标签管理（管理员 tab 侧栏）
 *
 * 展示标签库全部标签（含文章数），支持：
 * - 添加新标签（去重由后端保证，重名返回 409）
 * - 删除标签（同步从所有文章移除，删除前二次确认）
 */
export default function TagManager() {
  const [name, setName] = useState('');

  const { data: tags = [], isLoading: loading, error } = useTagsQuery();
  const createTag = useCreateTagMutation();
  const deleteTag = useDeleteTagMutation();

  const errorMessage = error?.message ?? createTag.error?.message ?? deleteTag.error?.message;

  /** 添加标签 */
  async function handleAdd(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    try {
      await createTag.mutateAsync(value);
      setName('');
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  /** 删除标签 */
  async function handleDelete(tag: TagItem) {
    const countMsg = tag.count > 0 ? `（将从 ${String(tag.count)} 篇文章中移除）` : '';
    if (!window.confirm(`确定删除标签「${tag.name}」吗？${countMsg}此操作不可恢复。`)) return;
    try {
      await deleteTag.mutateAsync(tag.name);
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  return (
    <aside>
      <h2 className="mb-1 text-lg font-semibold tracking-[-0.02em]">标签管理</h2>
      <p className="mb-4 text-xs text-text-muted">
        文章必须选择已有分类标签，可在此增删。
      </p>

      <form onSubmit={(e) => { void handleAdd(e); }} className="mb-4 flex gap-2">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => { setName(e.target.value); }}
          placeholder="新标签名"
          maxLength={32}
        />
        <button type="submit" disabled={!name.trim()} className={btnGhost}>
          添加
        </button>
      </form>

      {errorMessage && <p className="mb-3 text-sm text-red-500">{errorMessage}</p>}

      {loading ? (
        <p className="py-6 text-center text-sm text-text-muted">加载中…</p>
      ) : tags.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">暂无标签，请先添加。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tags.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border-light)] px-3 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[0.6875rem] text-accent">
                  {t.count}
                </span>
              </span>
              <button
                type="button"
                onClick={() => { void handleDelete(t); }}
                className="shrink-0 text-xs text-red-500 transition-colors hover:bg-red-500/10"
                aria-label={`删除标签 ${t.name}`}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
