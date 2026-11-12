import { PLAN_CONTENT } from '@/constants';
import type { PlanContent, PlanGoal, PlanStage } from '@/types/api';

import { normalizePlanContent } from '../../plan/planData';
import { EditorCard, Field, SaveBar } from './contentFields';
import PlanStageFields from './PlanStageFields';
import { editorBtnAdd, useContentEditor } from './useContentEditor';

function newID(prefix: string): string {
  return [prefix, String(Date.now()), Math.random().toString(36).slice(2, 8)].join('-');
}

function emptyGoal(): PlanGoal {
  return { id: newID('goal'), title: '', desc: '', status: 'planned' };
}

function emptyStage(order: number): PlanStage {
  return { id: newID('stage'), order, title: '', summary: '', goals: [emptyGoal()] };
}

/** 规划管理：维护唯一总目标及其阶段、子目标；阶段状态由子目标自动计算。 */
export default function PlanEditor({ value }: { value: unknown }) {
  const normalizedValue = value === undefined ? undefined : normalizePlanContent(value, PLAN_CONTENT);
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<PlanContent>('plan', normalizedValue);
  if (draft === null) return null;

  const updateStage = (index: number, next: PlanStage) => {
    setDraft((current) => current === null ? current : { ...current, stages: current.stages.map((stage, stageIndex) => stageIndex === index ? next : stage) });
  };

  return (
    <EditorCard
      title="阶段性目标"
      desc="维护一个总目标和多个阶段。阶段状态、阶段进度与总进度均由子目标的完成状态自动计算。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(normalizedValue ?? null); }} />}
    >
      <div className="grid gap-3">
        <Field label="总目标标题" value={draft.title} placeholder="如 学习 Go" onChange={(title) => { setDraft({ ...draft, title }); }} />
        <Field label="总目标简介（可选）" textarea rows={3} value={draft.summary} placeholder="这段时间希望建立什么能力…" onChange={(summary) => { setDraft({ ...draft, summary }); }} />
      </div>
      <div className="space-y-3 border-t border-[var(--color-border-light)] pt-4">
        <p className="text-sm font-semibold">阶段列表</p>
        {draft.stages.map((stage, index) => (
          <PlanStageFields
            key={stage.id}
            stage={stage}
            onChange={(next) => { updateStage(index, next); }}
            onRemove={() => { setDraft({ ...draft, stages: draft.stages.filter((_, stageIndex) => stageIndex !== index) }); }}
            createGoal={emptyGoal}
          />
        ))}
        <button type="button" className={editorBtnAdd} onClick={() => { setDraft({ ...draft, stages: [...draft.stages, emptyStage(Math.max(0, ...draft.stages.map((stage) => stage.order)) + 1)] }); }}>+ 添加阶段</button>
      </div>
    </EditorCard>
  );
}
