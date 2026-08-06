import type { EducationItem } from '@/types/api';

import { EditorCard, Field, SaveBar } from './contentFields';
import { editorBtnAdd, editorBtnDanger, useContentEditor } from './useContentEditor';

/**
 * 教育背景编辑器（简历页「教育背景」）
 */
export default function EducationEditor({ value }: { value: EducationItem[] | undefined }) {
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<EducationItem[]>('education', value);
  if (draft === null) return null;

  const update = (i: number, patch: Partial<EducationItem>) => {
    setDraft((prev) => (prev === null ? prev : prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))));
  };
  const remove = (i: number) => {
    setDraft((prev) => (prev === null ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const add = () => {
    setDraft((prev) => (prev === null ? prev : [...prev, { year: '', title: '', school: '', desc: '' }]));
  };

  return (
    <EditorCard
      title="教育背景"
      desc="简历页「教育背景」区块，保存后立即生效。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(value ?? null); }} />}
    >
      {draft.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="年份" value={item.year} placeholder="如 2024.9 – 至今" onChange={(v) => { update(i, { year: v }); }} />
            <Field label="专业 / 职位" value={item.title} onChange={(v) => { update(i, { title: v }); }} />
            <Field label="学校 / 公司" value={item.school} onChange={(v) => { update(i, { school: v }); }} />
          </div>
          <Field label="描述" textarea rows={2} value={item.desc} onChange={(v) => { update(i, { desc: v }); }} />
          <div className="flex justify-end">
            <button type="button" className={editorBtnDanger} onClick={() => { remove(i); }}>删除此项</button>
          </div>
        </div>
      ))}
      <button type="button" className={editorBtnAdd} onClick={add}>+ 添加教育经历</button>
    </EditorCard>
  );
}
