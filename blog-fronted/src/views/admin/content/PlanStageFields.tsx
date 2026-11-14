import { PLAN_STATUS_OPTIONS } from '@/constants';
import type { PlanGoal, PlanStage } from '@/types/api';

import { Field, SelectField } from './contentFields';
import { editorBtnAdd, editorBtnDanger, editorBtnGhost, editorInputClass } from './useContentEditor';

function GoalFields({ goal, onChange, onRemove }: { goal: PlanGoal; onChange: (goal: PlanGoal) => void; onRemove: () => void }) {
  return (
    <div className="space-y-3 border border-[var(--color-border-light)] bg-bg-alt p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="子目标标题" value={goal.title} placeholder="如 完成第一个 Gin 接口" onChange={(title) => { onChange({ ...goal, title }); }} />
        <SelectField label="状态" value={goal.status} options={PLAN_STATUS_OPTIONS} onChange={(status) => { onChange({ ...goal, status }); }} />
      </div>
      <Field label="说明（可选）" textarea rows={2} value={goal.desc} placeholder="这件事完成到什么程度…" onChange={(desc) => { onChange({ ...goal, desc }); }} />
      <div className="text-right"><button type="button" className={editorBtnDanger} onClick={onRemove}>删除子目标</button></div>
    </div>
  );
}

export default function PlanStageFields({ stage, onChange, onRemove, createGoal, isCurrent, onToggleCurrent }: {
  stage: PlanStage;
  onChange: (stage: PlanStage) => void;
  onRemove: () => void;
  createGoal: () => PlanGoal;
  isCurrent: boolean;
  onToggleCurrent: () => void;
}) {
  return (
    <section className="space-y-4 border border-[var(--color-border)] p-4">
      <div className="grid gap-3 sm:grid-cols-[5.5rem_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-muted">展示序号</span>
          <input
            type="number"
            min="1"
            max="9999"
            className={editorInputClass}
            value={stage.order}
            onChange={(event) => { onChange({ ...stage, order: Number(event.target.value) }); }}
          />
        </label>
        <Field label="阶段标题" value={stage.title} placeholder="如 Go 基础与工具链" onChange={(title) => { onChange({ ...stage, title }); }} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isCurrent && <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">当前阶段</span>}
          <button type="button" className={editorBtnGhost} onClick={onToggleCurrent}>{isCurrent ? '取消当前' : '设为当前'}</button>
          <button type="button" className={editorBtnDanger} onClick={onRemove}>删除阶段</button>
        </div>
      </div>
      <Field label="阶段说明（可选）" textarea rows={2} value={stage.summary} placeholder="这个阶段要建立什么能力…" onChange={(summary) => { onChange({ ...stage, summary }); }} />

      <div className="space-y-3 border-t border-[var(--color-border-light)] pt-4">
        <div>
          <p className="text-sm font-semibold">子目标</p>
          <p className="mt-1 text-xs text-text-muted">阶段状态与进度会依据这里的完成状态自动计算。</p>
        </div>
        {stage.goals.map((goal, index) => (
          <GoalFields
            key={goal.id}
            goal={goal}
            onChange={(next) => { onChange({ ...stage, goals: stage.goals.map((item, itemIndex) => itemIndex === index ? next : item) }); }}
            onRemove={() => { onChange({ ...stage, goals: stage.goals.filter((_, itemIndex) => itemIndex !== index) }); }}
          />
        ))}
        <button type="button" className={editorBtnAdd} onClick={() => { onChange({ ...stage, goals: [...stage.goals, createGoal()] }); }}>+ 添加子目标</button>
      </div>
    </section>
  );
}
