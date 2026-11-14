import { PLAN_CONTENT } from '@/constants';
import type { PlanContent, PlanGoal, PlanStage } from '@/types/api';

import { normalizePlanContent } from '../../plan/planData';
import { EditorCard, SaveBar } from './contentFields';
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

/** 规划管理：按阶段维护标题、说明与子目标；阶段状态与进度由子目标自动计算。 */
export default function PlanEditor({ value }: { value: unknown }) {
  const normalizedValue = value === undefined ? undefined : normalizePlanContent(value, PLAN_CONTENT);
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<PlanContent>('plan', normalizedValue);
  if (draft === null) return null;

  const updateStage = (index: number, next: PlanStage) => {
    setDraft((current) => current === null ? current : { ...current, stages: current.stages.map((stage, stageIndex) => stageIndex === index ? next : stage) });
  };

  return (
    <EditorCard
      title="阶段列表"
      desc="阶段状态、阶段进度与总进度均由子目标的完成状态自动计算。"
      footer={<SaveBar dirty={dirty} saving={saving} error={error} onSave={() => { void save(); }} onReset={() => { setDraft(normalizedValue ?? null); }} />}
    >
      <div className="space-y-3">
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
