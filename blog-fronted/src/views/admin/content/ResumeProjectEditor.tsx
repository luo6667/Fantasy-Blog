import type { ResumeProjectItem } from '@/types/api';

import { EditorCard, Field, SaveBar } from './contentFields';
import { editorBtnAdd, editorBtnDanger, editorInputClass, useContentEditor } from './useContentEditor';

/**
 * 项目经历编辑器（简历页「项目经历」，含多段描述）
 */
export default function ResumeProjectEditor({ value }: { value: ResumeProjectItem[] | undefined }) {
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<ResumeProjectItem[]>('resumeProjects', value);
  if (draft === null) return null;

  const update = (i: number, patch: Partial<ResumeProjectItem>) => {
    setDraft((prev) => (prev === null ? prev : prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))));
  };
  const updateDesc = (i: number, j: number, v: string) => {
    setDraft((prev) =>
      prev === null
        ? prev
        : prev.map((it, idx) => (idx === i ? { ...it, desc: it.desc.map((d, jdx) => (jdx === j ? v : d)) } : it)),
    );
  };
  const addDesc = (i: number) => {
    setDraft((prev) =>
      prev === null ? prev : prev.map((it, idx) => (idx === i ? { ...it, desc: [...it.desc, ''] } : it)),
    );
  };
  const removeDesc = (i: number, j: number) => {
    setDraft((prev) =>
      prev === null
        ? prev
        : prev.map((it, idx) => (idx === i ? { ...it, desc: it.desc.filter((_, jdx) => jdx !== j) } : it)),
    );
  };
  const remove = (i: number) => {
    setDraft((prev) => (prev === null ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const add = () => {
    setDraft((prev) => (prev === null ? prev : [...prev, { title: '', meta: '', desc: [''] }]));
  };

  return (
    <EditorCard
      title="项目经历"
      desc="简历页「项目经历」区块：每个项目含名称、meta（时间 · 技术栈）与多段描述。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(value ?? null); }} />}
    >
      {draft.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-[var(--color-border-light)] p-4">
          <Field label="项目名称" value={item.title} placeholder="如 电商平台重构" onChange={(v) => { update(i, { title: v }); }} />
          <Field label="meta（时间 · 技术栈，用 · 分隔）" value={item.meta} placeholder="如 2023 – 2024 · React · TypeScript" onChange={(v) => { update(i, { meta: v }); }} />
          <div className="space-y-2">
            <span className="text-xs text-text-muted">描述段落</span>
            {item.desc.map((d, j) => (
              <div key={j} className="flex items-start gap-2">
                <textarea className={editorInputClass} rows={2} value={d ?? ''} onChange={(e) => { updateDesc(i, j, e.target.value); }} />
                <button type="button" className={editorBtnDanger} onClick={() => { removeDesc(i, j); }}>删除</button>
              </div>
            ))}
            <button type="button" className={editorBtnAdd} onClick={() => { addDesc(i); }}>+ 添加描述段落</button>
          </div>
          <div className="flex justify-end">
            <button type="button" className={editorBtnDanger} onClick={() => { remove(i); }}>删除项目</button>
          </div>
        </div>
      ))}
      <button type="button" className={editorBtnAdd} onClick={add}>+ 添加项目</button>
    </EditorCard>
  );
}
