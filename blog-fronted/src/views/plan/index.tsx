'use client';

import { motion } from 'motion/react';

import { BgOrbs } from '@/components/common';
import { PLAN_STAGES } from '@/constants';
import { useSiteContentQuery } from '@/hooks/queries';
import type { PlanStage } from '@/types/api';

import PlanTimeline from './PlanTimeline';

/** 把 ISO 时间格式化成 YYYY-MM-DD（本地时区；非法时间返回 null） */
function formatDay(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function Plan() {
  // 内容来自管理后台可编辑的站点内容；未加载 / 加载失败时回退到默认常量，保证页面始终有内容
  const planQuery = useSiteContentQuery('plan');
  const stages = (planQuery.data?.value as PlanStage[] | undefined) ?? PLAN_STAGES;

  const goalCount = stages.reduce((sum, stage) => sum + stage.goals.length, 0);
  const doneCount = stages.reduce(
    (sum, stage) => sum + stage.goals.filter((goal) => goal.status === 'done').length,
    0,
  );
  const updatedDay = formatDay(planQuery.data?.updatedAt);

  return (
    <main>
      <BgOrbs />

      {/* Intro */}
      <section className="px-6 pb-8 pt-16">
        <div className="mx-auto max-w-page">
          <motion.h1
            className="mb-1.5 text-[clamp(2rem,5vw,2.75rem)] font-extrabold tracking-[-0.03em]"
            initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 0.5, delay: 0.08 }}
          >
            成长<span className="text-accent">规划</span>
          </motion.h1>
          <motion.p
            className="mb-4 max-w-[34rem] text-base leading-[1.6] text-text-secondary"
            initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.16 }}
          >
            把想学、想做的拆成阶段，一步一步推进。
          </motion.p>
          <motion.div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-[var(--color-border-light)] pt-4 text-sm text-text-muted"
            initial={{ opacity: 0, y: 16, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.24 }}
          >
            {updatedDay && (
              <>
                <span>最近更新 {updatedDay}</span>
                <span aria-hidden="true" className="text-[var(--color-border)]">
                  ·
                </span>
              </>
            )}
            <span>{stages.length} 个阶段</span>
            <span aria-hidden="true" className="text-[var(--color-border)]">
              ·
            </span>
            <span>{goalCount} 个目标</span>
            <span aria-hidden="true" className="text-[var(--color-border)]">
              ·
            </span>
            <span>
              <span className="font-semibold text-success">{doneCount}</span> 个已完成
            </span>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="relative z-[1] px-6 pb-16 pt-2">
        <div className="mx-auto max-w-page">
          <PlanTimeline stages={stages} />
        </div>
      </section>
    </main>
  );
}
