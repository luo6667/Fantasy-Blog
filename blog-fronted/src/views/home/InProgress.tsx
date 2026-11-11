'use client';

import Link from 'next/link';

import type { PlanStage } from '@/types/api';

const STATUS_LABEL: Record<PlanStage['status'], string> = {
  planned: '计划中',
  active: '进行中',
  done: '已完成',
};

/**
 * In Progress：正在构建
 *
 * 从 plan 里取「进行中」阶段及其后 1–2 个阶段，做成一条极简时间线；
 * 首页只展示摘要，完整路线图仍在 /plan。
 */
export default function InProgress({ stages }: { stages: PlanStage[] }) {
  if (stages.length === 0) return null;
  const activeIndex = Math.max(
    0,
    stages.findIndex((s) => s.status === 'active'),
  );
  const start = stages[activeIndex] ? activeIndex : 0;
  const picked = stages.slice(start, start + 3);
  if (picked.length === 0) return null;

  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
              In Progress
            </p>
            <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em]">正在构建</h2>
          </div>
          <Link
            href="/plan"
            className="border-b border-[var(--color-text)]/30 pb-1 text-sm font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            查看完整规划 →
          </Link>
        </div>

        <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
          {picked.map((stage) => (
            <li
              key={`${stage.period}-${stage.title}`}
              className="relative border-l border-[var(--color-border)] pl-6 md:border-l-0 md:border-t md:pl-0 md:pt-6"
            >
              <span
                aria-hidden
                className="absolute -left-[4px] top-0 h-2 w-2 rounded-full bg-accent md:-top-[4px] md:left-0"
              />
              <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {stage.period}
              </p>
              <h3 className="mb-2 text-[1.05rem] font-bold leading-[1.4] tracking-[-0.01em]">
                {stage.title}
              </h3>
              <p className="mb-3 line-clamp-2 text-[0.9rem] leading-[1.7] text-text-muted">
                {stage.summary}
              </p>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent">
                {STATUS_LABEL[stage.status]}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
