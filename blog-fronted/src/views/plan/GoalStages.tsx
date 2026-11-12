'use client';

import { Progress } from 'antd';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { PLAN_STATUS_LABEL } from '@/constants';
import { heroItem, staggerContainer } from '@/lib/motion';
import type { PlanContent, PlanStage } from '@/types/api';

import { calculateProgress, findCurrentStage, sortPlanStages } from './planData';

const statusClass = {
  planned: 'border-[var(--color-border)] text-text-muted',
  active: 'border-accent/40 bg-accent/10 text-accent',
  done: 'border-success/40 bg-success/10 text-success',
};

function GoalRow({ goal, index }: { goal: PlanStage['goals'][number]; index: number }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 border-b border-[var(--color-border-light)] py-4 last:border-b-0">
      <span className="mt-1 font-mono text-xs text-text-muted">{String(index + 1).padStart(2, '0')}</span>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{goal.title || '未命名子目标'}</h3>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass[goal.status]}`}>
            {PLAN_STATUS_LABEL[goal.status]}
          </span>
        </div>
        {goal.desc && <p className="mt-1.5 text-sm leading-6 text-text-muted">{goal.desc}</p>}
      </div>
    </li>
  );
}

function StagePanel({ stage, open, onToggle }: { stage: PlanStage; open: boolean; onToggle: () => void }) {
  const progress = calculateProgress(stage.goals);
  const panelID = `plan-stage-${stage.id}`;

  return (
    <article className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        type="button"
        className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 py-5 text-left outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
        aria-expanded={open}
        aria-controls={panelID}
        onClick={onToggle}
      >
        <span className="font-mono text-xs text-text-muted">{String(stage.order).padStart(2, '0')}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-base font-bold tracking-[-0.02em] text-[var(--color-text)] group-hover:text-accent">{stage.title || '未命名阶段'}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass[progress.status]}`}>{PLAN_STATUS_LABEL[progress.status]}</span>
          </span>
          <Progress className="mt-3 block max-w-md" percent={progress.percent} showInfo={false} size={{ height: 10 }} strokeColor="var(--color-accent)" railColor="var(--color-border-light)" />
          <span className="mt-1.5 block text-xs text-text-muted">{progress.done} / {progress.total} 个子目标完成</span>
        </span>
        <span aria-hidden="true" className={`text-lg text-text-muted transition-transform duration-200 ${open ? 'rotate-45 text-accent' : ''}`}>+</span>
      </button>

      {open && (
        <div id={panelID} className="mb-5 border border-[var(--color-border-light)] bg-bg-alt p-4 md:p-5">
          {stage.summary && <p className="max-w-2xl text-sm leading-6 text-text-muted">{stage.summary}</p>}
          {stage.goals.length > 0 ? (
            <ul className="mt-3 max-h-96 overflow-y-auto pr-2" aria-label={`${stage.title}的子目标`}>
              {stage.goals.map((goal, goalIndex) => <GoalRow key={goal.id} goal={goal} index={goalIndex} />)}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-muted">这个阶段还没有子目标。</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function GoalStages({ content }: { content: PlanContent }) {
  const stages = sortPlanStages(content.stages);
  const defaultOpenID = findCurrentStage(content)?.id ?? stages[0]?.id;
  const [openID, setOpenID] = useState(defaultOpenID);

  useEffect(() => {
    setOpenID((current) => stages.some((stage) => stage.id === current) ? current : defaultOpenID);
  }, [stages, defaultOpenID]);

  if (stages.length === 0) {
    return <p className="border-y border-[var(--color-border)] py-10 text-sm text-text-muted">还没有阶段性目标，先从后台添加第一个阶段。</p>;
  }

  return (
    <motion.div
      className="border-t border-[var(--color-border)]"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px 0px' }}
      variants={staggerContainer}
    >
      {stages.map((stage) => (
        <motion.div key={stage.id} variants={heroItem}>
          <StagePanel stage={stage} open={stage.id === openID} onToggle={() => { setOpenID((current) => current === stage.id ? undefined : stage.id); }} />
        </motion.div>
      ))}
    </motion.div>
  );
}
