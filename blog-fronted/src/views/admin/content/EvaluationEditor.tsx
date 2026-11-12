import { EditorCard, SaveBar } from './contentFields';
import { editorInputClass, useContentEditor } from './useContentEditor';

/**
 * 个人评价编辑器（简历页「个人评价」，单段文本）
 */
export default function EvaluationEditor({ value }: { value: string | undefined }) {
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<string>('evaluation', value);
  if (draft === null) return null;

  return (
    <EditorCard
      title="个人评价"
      desc="简历页「个人评价」区块，一段自我介绍文本。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(value ?? ''); }} />}
    >
      <textarea
        className={editorInputClass}
        rows={6}
        value={draft ?? ''}
        placeholder="写一段个人评价…"
        onChange={(e) => { setDraft(e.target.value); }}
      />
    </EditorCard>
  );
}
