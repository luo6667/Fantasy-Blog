'use client';

import Link from 'next/link';

import type { ContributionDay, ContributionsData } from '@/lib/contributions';

/** 每周 7 行对应 周日..周六；行标签只在 一/三/五 显示 */
const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', ''] as const;

const MONTH_NAMES = [
  '',
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

interface Cell {
  date: string;
  count: number;
  level: number;
  github?: ContributionDay;
  gitee?: ContributionDay;
}

/**
 * GitHub 贡献热力图（纯展示，数据由 Server Component 获取后以 props 传入）
 *
 * 52 周 × 7 天的绿色方块网格：颜色深浅由 level(0-4) 决定（CSS 变量 --gh-0..4，
 * 随主题亮暗切换），悬停显示日期与贡献数。无数据时渲染 null。
 */
export default function GitHubContributions({
  data,
  className = 'mb-10',
}: {
  data: ContributionsData | null;
  className?: string;
}) {
  if (!data || (data.github.days.length === 0 && data.gitee.days.length === 0)) return null;

  const currentYear = String(new Date().getFullYear());
  const byDate = new Map<string, { github?: Cell; gitee?: Cell }>();
  for (const day of data.github.days.filter((item) => item.date.startsWith(currentYear))) byDate.set(day.date, { ...(byDate.get(day.date) ?? {}), github: day });
  for (const day of data.gitee.days.filter((item) => item.date.startsWith(currentYear))) byDate.set(day.date, { ...(byDate.get(day.date) ?? {}), gitee: day });
  const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  // —— 预处理：按周分组（列），格子定位到 weekday(0=周日 .. 6=周六) ——
  const firstDay = days[0]?.[1].github ?? days[0]?.[1].gitee;
  if (!firstDay) return null;
  const start = new Date(`${firstDay.date}T00:00:00Z`);
  const startWeekday = start.getUTCDay();

  const weeks = new Map<number, (Cell | null)[]>();
  for (const [date, pair] of days) {
    const day = pair.github ?? pair.gitee;
    if (!day) continue;
    const dt = new Date(`${day.date}T00:00:00Z`);
    const diff = Math.floor((dt.getTime() - start.getTime()) / 86_400_000);
    const week = Math.floor((diff + startWeekday) / 7);
    let col = weeks.get(week);
    if (!col) {
      col = Array<Cell | null>(7).fill(null);
      weeks.set(week, col);
    }
    col[dt.getUTCDay()] = { date, count: (pair.github?.count ?? 0) + (pair.gitee?.count ?? 0), level: 0, ...pair } as Cell;
  }
  const cols = [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([, col]) => col);

  // 列顶部月份：与该列首个有值日期所属月份匹配；与前一列相同时留空
  const monthLabel = (col: (Cell | null)[], prev: (Cell | null)[] | null): string => {
    const first = col.find((c): c is Cell => c !== null);
    if (!first) return '';
    const m = Number(first.date.slice(5, 7));
    const prevFirst = prev?.find((c): c is Cell => c !== null);
    const prevM = prevFirst ? Number(prevFirst.date.slice(5, 7)) : -1;
    return m !== prevM ? (MONTH_NAMES[m] ?? '') : '';
  };

  return (
    <div className={`rounded-lg border border-[var(--color-border-light)] bg-surface/60 p-4 sm:p-5 ${className}`}>
      {/* 标题行 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="https://github.com/luo6667"
          target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:text-accent"
        >
          <i className="iconfont icon-GitHub" />
          代码足迹 · GitHub × Gitee
        </Link>
        <span className="text-xs text-text-muted">GitHub {data.github.total} · Gitee {data.gitee.total}</span>
      </div>

      <div className="min-w-0 overflow-x-auto">
        {/* 月份标签行（左端缩进与周几标签列对齐） */}
        <div className="mb-[3px] flex gap-[3px] pl-[31px]">
          {cols.map((col, i) => (
            <div
              key={i}
              className="h-4 w-[10px] shrink-0 text-center text-[10px] leading-4 text-text-muted"
            >
              {monthLabel(col, i > 0 ? (cols[i - 1] ?? null) : null)}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* 周几标签列 */}
          <div className="mr-[3px] flex w-7 shrink-0 flex-col gap-[3px]">
            {WEEKDAY_LABELS.map((label, row) => (
              <div key={row} className="h-[10px] text-[10px] leading-[10px] text-text-muted">
                {label}
              </div>
            ))}
          </div>

          {/* 热力网格：grid-flow-col，每列 7 格（周日在上） */}
          <div
            className="grid grid-flow-col gap-[3px]"
            style={{ gridTemplateRows: 'repeat(7, 10px)', gridAutoColumns: '10px' }}
          >
            {cols.flatMap((col, wi) =>
              col.map((cell, row) => (
                <div key={wi * 7 + row} className="group relative">
                  <div
                    className="h-[10px] w-[10px] rounded-[2px]"
                    style={{
                      background: cell ? `linear-gradient(90deg, var(--gh-${String(cell.github?.level ?? 0)}) 0 50%, ${cell.gitee?.count ? 'var(--color-progress-active)' : 'var(--gh-0)'} 50% 100%)` : 'transparent',
                    }}
                  />
                  {cell && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-1.5 py-1 text-[10px] font-medium leading-none text-white shadow-lg group-hover:block">
                      GitHub {cell.github?.count ?? '—'} · Gitee {cell.gitee?.count ?? '—'} · {cell.date}
                    </div>
                  )}
                </div>
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
