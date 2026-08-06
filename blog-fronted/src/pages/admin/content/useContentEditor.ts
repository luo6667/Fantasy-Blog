import { useEffect, useState } from 'react';

import { useUpdateSiteContentMutation } from '@/hooks/queries';
import type { SiteContentKey, SiteContentValue } from '@/types/api';

/**
 * 内容编辑器通用逻辑
 *
 * - 服务器数据到达后同步到本地草稿（draft）；用户编辑过程中不会被后台刷新覆盖
 * - save() 将该 key 的内容整体 PUT，保存成功以服务器规范化后的值为准
 * - dirty = 草稿与服务器值不一致（用于启用/禁用保存按钮）
 */
export function useContentEditor<T extends SiteContentValue>(
  key: SiteContentKey,
  loadedValue: T | undefined,
) {
  const updateMutation = useUpdateSiteContentMutation();
  const [draft, setDraft] = useState<T | null>(null);

  // 数据首次到达时初始化草稿；之后保持用户正在编辑的草稿不被覆盖
  useEffect(() => {
    if (loadedValue === undefined) return;
    setDraft((prev) => (prev === null ? loadedValue : prev));
  }, [loadedValue]);

  const dirty =
    draft !== null && loadedValue !== undefined && JSON.stringify(draft) !== JSON.stringify(loadedValue);

  async function save() {
    if (draft === null) return;
    const item = await updateMutation.mutateAsync({ key, value: draft });
    // 以服务器返回（已 trim/校验）的值同步草稿，保证 dirty 状态准确
    setDraft(item.value as T);
  }

  return {
    draft,
    setDraft,
    dirty,
    saving: updateMutation.isPending,
    error: updateMutation.error?.message,
    save,
  };
}

/* ---------- 共享样式常量 ---------- */

export const editorInputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-accent';

export const editorBtnGhost =
  'shrink-0 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40';

export const editorBtnDanger =
  'shrink-0 rounded-md px-2.5 py-1 text-sm text-red-500 transition-colors hover:bg-red-500/10';

export const editorBtnAdd =
  'rounded-md border border-dashed border-[var(--color-border)] px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent';
