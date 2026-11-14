'use client';

import { Card, Listy, Progress, Tag } from 'antd';

import { PLAN_STATUS_LABEL } from '@/constants';
import type { PlanGoal, PlanStage } from '@/types/api';

import { calculateProgress } from './planData';

const statusColor = {
  planned: 'default',
  active: 'orange',
  done: 'green',
} as const;

const statusDotClass = {
  planned: 'border border-[var(--color-border)] bg-transparent',
  active: 'bg-[var(--color-progress-active)]',
  done: 'bg-success',
} as const;

function goalsWithActiveFirst(goals: PlanGoal[]) {
  return goals
    .map((goal, index) => ({ goal, index }))
    .sort((a, b) => Number(b.goal.status === 'active') - Number(a.goal.status === 'active') || a.index - b.index)
    .map(({ goal }) => goal);
}

function GoalRow({ goal }: { goal: PlanGoal }) {
  return (
    <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${statusDotClass[goal.status]}`} />
      <p className="truncate text-sm font-semibold text-[var(--color-text)]">{goal.title || '未命名子目标'}</p>
      <Tag color={statusColor[goal.status]} className="m-0 shrink-0">{PLAN_STATUS_LABEL[goal.status]}</Tag>
    </div>
  );
}

/** A 方案：紧凑阶段仪表卡，固定三行任务窗口并由 Ant Design Listy 提供内部滚动。 */
export default function CurrentStageChecklist({ stage }: { stage: PlanStage | undefined }) {
  const goals = goalsWithActiveFirst(stage?.goals ?? []);
  const progress = stage ? calculateProgress(stage.goals) : null;

  return (
    <Card
      className="plan-stage-checklist shadow-none"
      styles={{
        root: { background: 'var(--color-bg-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text)' },
        body: { height: '100%', padding: 0 },
      }}
      aria-label="当前阶段清单"
    >
      <div className="flex h-full flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent">Stage dashboard</p>
          <span className="font-mono text-sm text-text-muted">{stage ? String(stage.order).padStart(2, '0') : '—'}</span>
        </div>

        {stage ? (
          <>
            <div className="mt-4 flex items-center gap-5 border-y border-[var(--color-border-light)] py-4">
              <Progress type="circle" percent={progress?.percent ?? 0} size={92} strokeWidth={10} strokeColor="var(--color-accent)" railColor="var(--color-border-light)" />
              <div className="min-w-0">
                <p className="text-sm text-text-muted">阶段进度</p>
                <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">{progress?.done} / {progress?.total}</p>
              </div>
            </div>

            {goals.length > 0 ? (
              <Listy
                className="mt-3"
                items={goals}
                rowKey="id"
                height={174}
                virtual
                rowHoverable={false}
                styles={{ item: { height: 58, minHeight: 58, padding: '0 0.25rem' } }}
                itemRender={(goal) => <GoalRow goal={goal} />}
              />
            ) : (
              <p className="mt-5 text-sm text-text-muted">这个阶段还没有子目标。</p>
            )}
          </>
        ) : (
          <p className="mt-5 text-sm leading-6 text-text-muted">当前没有待推进的阶段。新增子目标后，计划会从这里开始。</p>
        )}
      </div>
    </Card>
  );
}
