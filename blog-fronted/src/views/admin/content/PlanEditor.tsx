import { PLAN_STATUS_OPTIONS } from '@/constants';
import type { PlanGoal, PlanStage } from '@/types/api';

import { EditorCard, Field, SaveBar, SelectField } from './contentFields';
import {
  editorBtnAdd,
  editorBtnDanger,
  editorBtnGhost,
  editorInputClass,
  useContentEditor,
} from './useContentEditor';

/** 新目标空值 */
const emptyGoal = (): PlanGoal => ({ title: '', desc: '', status: 'planned', tags: [] });

/** 新阶段空值 */
const emptyStage = (): PlanStage => ({
  period: '',
  title: '',
  summary: '',
  status: 'planned',
  goals: [],
});

/** 上移 / 下移一个元素（dir: -1 上移，1 下移；越界时原样返回） */
function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  const tmp = next[i] as T;
  next[i] = next[j] as T;
  next[j] = tmp;
  return next;
}

/**
 * 规划路线图编辑器（规划页「成长规划」时间轴）
 *
 * 两级结构：阶段（时间段 / 标题 / 概览 / 状态）→ 目标（标题 / 描述 / 状态 / 标签）。
 * 时间轴按数组顺序展示，所以阶段与阶段内目标都提供上移 / 下移；
 * 新增阶段追加到末尾（时间从前到后），新增目标追加到该阶段末尾。
 */
export default function PlanEditor({ value }: { value: PlanStage[] | undefined }) {
  const { draft, setDraft, dirty, saving, error, save } = useContentEditor<PlanStage[]>('plan', value);
  if (draft === null) return null;

  /** 更新单个阶段 */
  const patchStage = (i: number, fn: (stage: PlanStage) => PlanStage) => {
    setDraft((prev) =>
      prev === null ? prev : prev.map((stage, idx) => (idx === i ? fn(stage) : stage)),
    );
  };
  /** 更新阶段 i 下的目标 j（减少两层数组的重复代码） */
  const patchGoal = (i: number, j: number, fn: (goal: PlanGoal) => PlanGoal) => {
    patchStage(i, (stage) => ({
      ...stage,
      goals: stage.goals.map((goal, gdx) => (gdx === j ? fn(goal) : goal)),
    }));
  };

  const moveStage = (i: number, dir: -1 | 1) => {
    setDraft((prev) => (prev === null ? prev : moveItem(prev, i, dir)));
  };
  const moveGoal = (i: number, j: number, dir: -1 | 1) => {
    patchStage(i, (stage) => ({ ...stage, goals: moveItem(stage.goals, j, dir) }));
  };
  const addStage = () => {
    setDraft((prev) => (prev === null ? prev : [...prev, emptyStage()]));
  };
  const removeStage = (i: number) => {
    setDraft((prev) => (prev === null ? prev : prev.filter((_, idx) => idx !== i)));
  };
  const addGoal = (i: number) => {
    patchStage(i, (stage) => ({ ...stage, goals: [...stage.goals, emptyGoal()] }));
  };
  const removeGoal = (i: number, j: number) => {
    patchStage(i, (stage) => ({ ...stage, goals: stage.goals.filter((_, gdx) => gdx !== j) }));
  };
  const updateTag = (i: number, j: number, k: number, v: string) => {
    patchGoal(i, j, (goal) => ({ ...goal, tags: goal.tags.map((t, tdx) => (tdx === k ? v : t)) }));
  };
  const addTag = (i: number, j: number) => {
    patchGoal(i, j, (goal) => ({ ...goal, tags: [...goal.tags, ''] }));
  };
  const removeTag = (i: number, j: number, k: number) => {
    patchGoal(i, j, (goal) => ({ ...goal, tags: goal.tags.filter((_, tdx) => tdx !== k) }));
  };

  return (
    <EditorCard
      title="规划路线图"
      desc="规划页「成长规划」时间轴：每个阶段含时间段、标题、概览、状态与若干目标；阶段与目标都可用上移 / 下移调整顺序。"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          error={error}
          onSave={() => { void save(); }}
          onReset={() => { setDraft(value ?? null); }}
        />
      }
    >
      {draft.map((stage, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
            <Field
              label="时间段"
              value={stage.period}
              placeholder="如 2025.7 – 2026.6"
              onChange={(v) => { patchStage(i, (s) => ({ ...s, period: v })); }}
            />
            <Field
              label="阶段标题"
              value={stage.title}
              placeholder="如 进阶：React 生态与全栈项目"
              onChange={(v) => { patchStage(i, (s) => ({ ...s, title: v })); }}
            />
          </div>
          <Field
            label="阶段概览（可选，最多 200 字）"
            textarea
            rows={2}
            value={stage.summary}
            placeholder="一句话概括这个阶段的目标…"
            onChange={(v) => { patchStage(i, (s) => ({ ...s, summary: v })); }}
          />
          <div className="sm:max-w-[12rem]">
            <SelectField
              label="阶段状态"
              value={stage.status}
              options={PLAN_STATUS_OPTIONS}
              onChange={(v) => { patchStage(i, (s) => ({ ...s, status: v })); }}
            />
          </div>

          <div className="space-y-3 rounded-md border border-dashed border-[var(--color-border)] p-3">
            <span className="text-xs text-text-muted">阶段目标（{stage.goals.length}）</span>
            {stage.goals.map((goal, j) => (
              <div key={j} className="space-y-2 rounded-md bg-bg-alt p-3">
                <Field
                  label="目标标题"
                  value={goal.title}
                  placeholder="如 Next.js App Router 与 SSR / ISR"
                  onChange={(v) => { patchGoal(i, j, (g) => ({ ...g, title: v })); }}
                />
                <Field
                  label="目标描述（可选，最多 400 字）"
                  textarea
                  rows={2}
                  value={goal.desc}
                  placeholder="具体要学到什么程度…"
                  onChange={(v) => { patchGoal(i, j, (g) => ({ ...g, desc: v })); }}
                />
                <div className="sm:max-w-[12rem]">
                  <SelectField
                    label="目标状态"
                    value={goal.status}
                    options={PLAN_STATUS_OPTIONS}
                    onChange={(v) => { patchGoal(i, j, (g) => ({ ...g, status: v })); }}
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-text-muted">目标标签（最多 6 个）</span>
                  {goal.tags.map((tag, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <input
                        className={editorInputClass}
                        value={tag}
                        placeholder="如 React"
                        onChange={(e) => { updateTag(i, j, k, e.target.value); }}
                      />
                      <button
                        type="button"
                        className={editorBtnDanger}
                        onClick={() => { removeTag(i, j, k); }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <button type="button" className={editorBtnAdd} onClick={() => { addTag(i, j); }}>
                    + 添加标签
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={editorBtnGhost}
                    disabled={j === 0}
                    onClick={() => { moveGoal(i, j, -1); }}
                    title="上移"
                  >
                    ↑ 上移
                  </button>
                  <button
                    type="button"
                    className={editorBtnGhost}
                    disabled={j === stage.goals.length - 1}
                    onClick={() => { moveGoal(i, j, 1); }}
                    title="下移"
                  >
                    ↓ 下移
                  </button>
                  <button
                    type="button"
                    className={editorBtnDanger}
                    onClick={() => { removeGoal(i, j); }}
                  >
                    删除目标
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className={editorBtnAdd} onClick={() => { addGoal(i); }}>
              + 添加目标
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={editorBtnGhost}
              disabled={i === 0}
              onClick={() => { moveStage(i, -1); }}
              title="上移"
            >
              ↑ 上移
            </button>
            <button
              type="button"
              className={editorBtnGhost}
              disabled={i === draft.length - 1}
              onClick={() => { moveStage(i, 1); }}
              title="下移"
            >
              ↓ 下移
            </button>
            <button type="button" className={editorBtnDanger} onClick={() => { removeStage(i); }}>
              删除阶段
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={editorBtnAdd} onClick={addStage}>
        + 添加阶段
      </button>
    </EditorCard>
  );
}
