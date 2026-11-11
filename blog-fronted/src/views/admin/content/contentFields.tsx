import type { ReactNode } from 'react';

import { editorBtnGhost, editorInputClass } from './useContentEditor';

/** 单个表单字段（label + input / textarea） */
export function Field({
  label,
  value,
  onChange,
  textarea,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-muted">{label}</span>
      {textarea ? (
        <textarea
          className={editorInputClass}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); }}
        />
      ) : (
        <input
          className={editorInputClass}
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); }}
        />
      )}
    </label>
  );
}

/** 下拉选择字段（label + select） */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-muted">{label}</span>
      <select
        className={editorInputClass}
        value={value}
        onChange={(e) => { onChange(e.target.value as T); }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 编辑器卡片：标题 + 描述 + 内容 + 底部操作栏 */
export function EditorCard({
  title,
  desc,
  children,
  footer,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-border-light)] bg-surface p-5">
      <h3 className="mb-0.5 text-base font-semibold">{title}</h3>
      {desc && <p className="mb-4 text-sm text-text-muted">{desc}</p>}
      <div className="space-y-3">{children}</div>
      {footer && <div className="mt-4 border-t border-[var(--color-border-light)] pt-3">{footer}</div>}
    </section>
  );
}

/** 保存操作栏 */
export function SaveBar({
  dirty,
  saving,
  error,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onSave}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? '保存中…' : '保存'}
      </button>
      {dirty && (
        <button type="button" onClick={onReset} className={editorBtnGhost}>
          放弃修改
        </button>
      )}
      {!dirty && !error && !saving && <span className="text-xs text-text-muted">已同步</span>}
      {error && (
        <p className="w-full rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">
          保存失败：{error}
        </p>
      )}
    </div>
  );
}
