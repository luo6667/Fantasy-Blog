import { EditorCard, SaveBar } from './contentFields';
import { editorBtnAdd, editorBtnDanger, editorInputClass, useContentEditor } from './useContentEditor';

/**
 * 专业技能编辑器（简历页「专业技能」，每条为一段文字）
 */
export default function SkillEditor({ value }: { value: string[] | undefined }) {
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<string[]>('skills', value);
  if (draft === null) return null;

  const update = (i: number, v: string) => {
    setDraft((prev) => (prev === null ? prev : prev.map((s, idx) => (idx === i ? v : s))));
  };
  const remove = (i: number) => {
    setDraft((prev) => (prev === null ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const add = () => {
    setDraft((prev) => (prev === null ? prev : [...prev, '']));
  };

  return (
    <EditorCard
      title="专业技能"
      desc="简历页「专业技能」区块，每条一行（一段文字），可增删改。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(value ?? null); }} />}
    >
      {draft.map((s, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            className={editorInputClass}
            rows={2}
            value={s}
            placeholder="输入一条技能描述…"
            onChange={(e) => { update(i, e.target.value); }}
          />
          <button type="button" className={editorBtnDanger} onClick={() => { remove(i); }}>删除</button>
        </div>
      ))}
      <button type="button" className={editorBtnAdd} onClick={add}>+ 添加技能</button>
    </EditorCard>
  );
}
