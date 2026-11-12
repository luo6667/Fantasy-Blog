'use client';

import { motion } from 'motion/react';

import { BgOrbs } from '@/components/common';
import { PLAN_CONTENT } from '@/constants';
import { useSiteContentQuery } from '@/hooks/queries';
import { heroItem, staggerContainer } from '@/lib/motion';

import CurrentStageChecklist from './CurrentStageChecklist';
import GoalStages from './GoalStages';
import { calculatePlanProgress, findCurrentStage, normalizePlanContent } from './planData';

/** 一个总目标下的阶段性目标；每个阶段进度由其子目标的状态自动推导。 */
export default function Plan() {
  const planQuery = useSiteContentQuery('plan');
  const content = normalizePlanContent(planQuery.data?.value, PLAN_CONTENT);
  const progress = calculatePlanProgress(content);
  const currentStage = findCurrentStage(content);

  return (
    <main>
      <BgOrbs />

      <section className="border-b border-[var(--color-border)] px-6 pb-14 pt-20 md:pb-20 md:pt-28">
        <div className="mx-auto grid max-w-page gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)] lg:items-start lg:gap-16">
          <motion.div initial="hidden" animate="show" variants={staggerContainer}>
            <motion.p variants={heroItem} className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
              Personal focus / 阶段性目标
            </motion.p>
            <motion.h1 variants={heroItem} className="max-w-[14ch] text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.055em]">
              {content.title || '我的目标'}
            </motion.h1>
            {content.summary && (
              <motion.p variants={heroItem} className="mt-5 max-w-[43rem] text-[1rem] leading-[1.8] text-text-secondary">
                {content.summary}
              </motion.p>
            )}
            <motion.div variants={heroItem} className="mt-8 grid max-w-2xl gap-5 border-t border-[var(--color-border)] pt-4 text-sm sm:grid-cols-2">
              <p className="text-text-muted">总目标进度 <span className="ml-2 font-semibold text-accent">{progress.percent}% · {progress.done} / {progress.total}</span></p>
              <p className="text-text-muted">当前阶段 <span className="ml-2 font-semibold text-[var(--color-text)]">{currentStage?.title ?? (content.stages.length > 0 ? '全部阶段已完成' : '尚未开始')}</span></p>
            </motion.div>
          </motion.div>
          <motion.div initial="hidden" animate="show" variants={heroItem}>
            <CurrentStageChecklist stage={currentStage} />
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-page">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">Goal map</p>
              <h2 className="mt-2 text-[clamp(1.8rem,3.5vw,3rem)] font-extrabold tracking-[-0.04em]">阶段性目标</h2>
            </div>
            <p className="text-sm text-text-muted">展开一个阶段，专注眼前的子目标。</p>
          </div>
          <GoalStages content={content} />
        </div>
      </section>
    </main>
  );
}
