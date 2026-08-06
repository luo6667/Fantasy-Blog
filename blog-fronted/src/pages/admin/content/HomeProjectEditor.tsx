import type { HomeProjectItem } from '@/types/api';

import { EditorCard, Field, SaveBar } from './contentFields';
import { editorBtnAdd, editorBtnDanger, editorInputClass, useContentEditor } from './useContentEditor';

/**
 * 首页精选项目编辑器（首页「精选项目」，含标签增删）
 */
export default function HomeProjectEditor({ value }: { value: HomeProjectItem[] | undefined }) {
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<HomeProjectItem[]>('homeProjects', value);
  if (draft === null) return null;

  const update = (i: number, patch: Partial<HomeProjectItem>) => {
    setDraft((prev) => (prev === null ? prev : prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))));
  };
  const updateTag = (i: number, j: number, v: string) => {
    setDraft((prev) =>
      prev === null
        ? prev
        : prev.map((it, idx) => (idx === i ? { ...it, tags: it.tags.map((t, jdx) => (jdx === j ? v : t)) } : it)),
    );
  };
  const addTag = (i: number) => {
    setDraft((prev) =>
      prev === null ? prev : prev.map((it, idx) => (idx === i ? { ...it, tags: [...it.tags, ''] } : it)),
    );
  };
  const removeTag = (i: number, j: number) => {
    setDraft((prev) =>
      prev === null
        ? prev
        : prev.map((it, idx) => (idx === i ? { ...it, tags: it.tags.filter((_, jdx) => jdx !== j) } : it)),
    );
  };
  const remove = (i: number) => {
    setDraft((prev) => (prev === null ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const add = () => {
    setDraft((prev) => (prev === null ? prev : [...prev, { name: '', desc: '', tags: [], link: '' }]));
  };

  return (
    <EditorCard
      title="首页精选项目"
      desc="首页「精选项目」区块：每个项目含名称、描述与标签，标签可单独添加 / 删除。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(value ?? null); }} />}
    >
      {draft.map((item, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-[var(--color-border-light)] p-4">
          <Field label="项目名称" value={item.name} placeholder="如 电商平台重构" onChange={(v) => { update(i, { name: v }); }} />
          <Field label="描述" textarea rows={2} value={item.desc} placeholder="一句话介绍该项目…" onChange={(v) => { update(i, { desc: v }); }} />
          <Field label="仓库链接（可选，以 http(s):// 或 git@ 开头；留空则不显示跳转）" value={item.link ?? ''} placeholder="如 https://github.com/luo6667/xxx" onChange={(v) => { update(i, { link: v }); }} />
          <div className="space-y-2">
            <span className="text-xs text-text-muted">项目标签</span>
            {item.tags.map((t, j) => (
              <div key={j} className="flex items-center gap-2">
                <input className={editorInputClass} value={t} placeholder="如 React" onChange={(e) => { updateTag(i, j, e.target.value); }} />
                <button type="button" className={editorBtnDanger} onClick={() => { removeTag(i, j); }}>删除</button>
              </div>
            ))}
            <button type="button" className={editorBtnAdd} onClick={() => { addTag(i); }}>+ 添加标签</button>
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
