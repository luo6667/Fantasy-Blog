import { type SyntheticEvent, useState } from 'react';

import { useCreateTagMutation, useDeleteTagMutation, useRenameTagMutation, useTagsQuery } from '@/hooks/queries';
import type { TagItem } from '@/types/api';

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-accent';

const btnGhost =
  'rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent';

/**
 * 主标签管理（文章管理页侧栏）
 *
 * 展示主标签库全部标签（含文章数），支持：
 * - 添加新主标签（重名返回 409）
 * - 重命名主标签（文章同步显示新名字）
 * - 删除主标签（仍被文章引用时后端返回 409，避免悬空）
 */
export default function TagManager() {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const { data: tags = [], isLoading: loading, error } = useTagsQuery();
  const createTag = useCreateTagMutation();
  const renameTag = useRenameTagMutation();
  const deleteTag = useDeleteTagMutation();

  const errorMessage = error?.message ?? createTag.error?.message ?? renameTag.error?.message ?? deleteTag.error?.message;

  /** 添加主标签 */
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

  /** 开始重命名 */
  function startRename(tag: TagItem) {
    setEditingId(tag.id);
    setEditingName(tag.name);
  }

  /** 提交重命名 */
  async function submitRename() {
    const value = editingName.trim();
    if (!editingId || !value) return;
    try {
      await renameTag.mutateAsync({ id: editingId, name: value });
      setEditingId(null);
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  /** 删除主标签 */
  async function handleDelete(tag: TagItem) {
    if (
      !window.confirm(
        `确定删除主标签「${tag.name}」吗？仍被文章引用时无法删除，需先调整文章分类。`,
      )
    ) {
      return;
    }
    try {
      await deleteTag.mutateAsync(tag.id);
    } catch {
      /* 错误已通过 errorMessage 展示 */
    }
  }

  return (
    <aside>
      <h2 className="mb-1 text-lg font-semibold tracking-[-0.02em]">主标签管理</h2>
      <p className="mb-4 text-xs text-text-muted">
        每篇文章必须且只能选择一个主标签；子标签由文章自行维护，无需在此管理。
      </p>

      <form onSubmit={(e) => { void handleAdd(e); }} className="mb-4 flex gap-2">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => { setName(e.target.value); }}
          placeholder="新主标签名"
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
        <p className="py-6 text-center text-sm text-text-muted">暂无主标签，请先添加。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tags.map((t) => (
            <li
              key={t.id}
              className="rounded-md border border-[var(--color-border-light)] px-3 py-1.5"
            >
              {editingId === t.id ? (
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={editingName}
                    onChange={(e) => { setEditingName(e.target.value); }}
                    maxLength={32}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void submitRename();
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button type="button" onClick={() => { void submitRename(); }} className={btnGhost}>
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); }}
                    className="text-xs text-text-muted hover:text-accent"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm">
                    <span className="truncate">{t.name}</span>
                    <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[0.6875rem] text-accent">
                      {t.count}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => { startRename(t); }}
                      className="text-xs text-text-muted transition-colors hover:text-accent"
                    >
                      改名
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleDelete(t); }}
                      className="text-xs text-red-500 transition-colors hover:bg-red-500/10"
                      aria-label={`删除主标签 ${t.name}`}
                    >
                      删除
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
