import type { InternshipItem } from '@/types/api';

import { EditorCard, Field, SaveBar } from './contentFields';
import { editorBtnAdd, editorBtnDanger, editorInputClass, useContentEditor } from './useContentEditor';

/** 实习经历编辑器（简历页「实习经历」）。 */
export default function InternshipEditor({ value }: { value: InternshipItem[] | undefined }) {
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<InternshipItem[]>('internships', value);
  if (draft === null) return null;

  const update = (index: number, patch: Partial<InternshipItem>) => {
    setDraft((prev) => (prev === null ? prev : prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))));
  };
  const updateDesc = (index: number, descIndex: number, value: string) => {
    setDraft((prev) => prev === null ? prev : prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, desc: item.desc.map((desc, currentIndex) => (currentIndex === descIndex ? value : desc)) } : item
    )));
  };
  const addDesc = (index: number) => {
    setDraft((prev) => prev === null ? prev : prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, desc: [...item.desc, ''] } : item
    )));
  };
  const removeDesc = (index: number, descIndex: number) => {
    setDraft((prev) => prev === null ? prev : prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, desc: item.desc.filter((_, currentIndex) => currentIndex !== descIndex) } : item
    )));
  };

  return (
    <EditorCard
      title="实习经历"
      desc="简历页「实习经历」区块：填写公司、岗位、时间及职责描述；没有内容时前台不会显示该区块。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(value ?? null); }} />}
    >
      {draft.map((item, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="公司" value={item.company} placeholder="如 某科技有限公司" onChange={(value) => { update(index, { company: value }); }} />
            <Field label="岗位" value={item.role} placeholder="如 前端开发实习生" onChange={(value) => { update(index, { role: value }); }} />
          </div>
          <Field label="实习时间" value={item.period} placeholder="如 2026.07 – 2026.09" onChange={(value) => { update(index, { period: value }); }} />
          <div className="space-y-2">
            <span className="text-xs text-text-muted">职责描述</span>
            {item.desc.map((desc, descIndex) => (
              <div key={descIndex} className="flex items-start gap-2">
                <textarea className={editorInputClass} rows={2} value={desc ?? ''} onChange={(event) => { updateDesc(index, descIndex, event.target.value); }} />
                <button type="button" className={editorBtnDanger} onClick={() => { removeDesc(index, descIndex); }}>删除</button>
              </div>
            ))}
            <button type="button" className={editorBtnAdd} onClick={() => { addDesc(index); }}>+ 添加职责描述</button>
          </div>
          <div className="flex justify-end">
            <button type="button" className={editorBtnDanger} onClick={() => { setDraft((prev) => (prev === null ? prev : prev.filter((_, itemIndex) => itemIndex !== index))); }}>删除实习经历</button>
          </div>
        </div>
      ))}
      <button type="button" className={editorBtnAdd} onClick={() => { setDraft((prev) => (prev === null ? prev : [...prev, { company: '', role: '', period: '', desc: [''] }])); }}>+ 添加实习经历</button>
    </EditorCard>
  );
}
