'use client';

import Link from 'next/link';

import type { PlanContent } from '@/types/api';

import { calculatePlanProgress, findCurrentStage } from '../plan/planData';

/** 首页摘要：突出唯一总目标及当前阶段，不重复展示完整子目标列表。 */
export default function InProgress({ content }: { content: PlanContent }) {
  const progress = calculatePlanProgress(content);
  const stage = findCurrentStage(content);

  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-page border-y border-[var(--color-border)] py-8 md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-10">
        <div>
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">In Progress</p>
          <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em]">正在构建</h2>
          <Link href="/plan" className="mt-5 inline-block border-b border-[var(--color-text)]/30 pb-1 text-sm font-medium text-text-muted transition-colors hover:border-accent hover:text-accent">
            查看目标规划 →
          </Link>
        </div>
        <article className="mt-8 border-l border-[var(--color-border)] pl-6 md:mt-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Overall goal</p>
          <h3 className="mt-2 text-[1.2rem] font-bold leading-[1.4] tracking-[-0.02em]">{content.title || '我的目标'}</h3>
          {content.summary && <p className="mt-2 max-w-[52ch] text-[0.9rem] leading-[1.7] text-text-muted">{content.summary}</p>}
          <p className="mt-4 text-sm text-text-muted"><span className="font-semibold text-accent">{progress.done}/{progress.total}</span> 个子目标完成{stage && <> · 当前阶段：{stage.title}</>}</p>
        </article>
      </div>
    </section>
  );
}
