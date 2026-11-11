import { Reveal, Tag } from '@/components/common';
import { PLAN_STATUS_LABEL } from '@/constants';
import type { PlanGoal, PlanItemStatus, PlanStage } from '@/types/api';

/** 状态徽章配色：未开始描边、进行中强调色、已完成绿色 */
const BADGE_CLASS: Record<PlanItemStatus, string> = {
  planned: 'border-[var(--color-border)] bg-bg-alt text-text-muted',
  active: 'border-[var(--color-accent)] bg-accent-soft text-accent',
  done: 'border-[var(--color-success)] bg-success-soft text-success',
};

/** 时间线节点配色：已完成实心绿点、进行中空心强调色 + 呼吸点、未开始空心描边 */
const NODE_CLASS: Record<PlanItemStatus, string> = {
  planned: 'border-[var(--color-border)] bg-[var(--color-bg)]',
  active: 'border-[var(--color-accent)] bg-[var(--color-bg)]',
  done: 'border-[var(--color-success)] bg-success',
};

/** 勾选图标（12 × 12 网格，随 currentColor 变色） */
function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={className} aria-hidden="true">
      <path
        d="M2.4 6.3 4.7 8.6 9.6 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 状态徽章（未开始 / 进行中 / 已完成） */
function StatusBadge({ status }: { status: PlanItemStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold ${BADGE_CLASS[status]}`}
    >
      {status === 'done' && <CheckIcon className="h-2.5 w-2.5" />}
      {PLAN_STATUS_LABEL[status]}
    </span>
  );
}

/** 目标前的状态标记：已完成勾选圆、进行中带内点、未开始空心圆 */
function GoalMark({ status }: { status: PlanItemStatus }) {
  if (status === 'done') {
    return (
      <span className="mt-0.5 flex h-[1.0625rem] w-[1.0625rem] shrink-0 items-center justify-center rounded-full bg-success text-[var(--color-bg)]">
        <CheckIcon className="h-2.5 w-2.5" />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="relative mt-0.5 flex h-[1.0625rem] w-[1.0625rem] shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-accent)] bg-accent-soft">
        <span className="h-1 w-1 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 h-[1.0625rem] w-[1.0625rem] shrink-0 rounded-full border-2 border-[var(--color-border)]" />
  );
}

/** 阶段内的单个目标行 */
function GoalRow({ goal }: { goal: PlanGoal }) {
  return (
    <li className="flex gap-2.5">
      <GoalMark status={goal.status} />
      <div className="min-w-0">
        <p
          className={`text-[0.9375rem] font-medium leading-[1.5] ${
            goal.status === 'done' ? 'text-text-secondary' : 'text-[var(--color-text)]'
          }`}
        >
          {goal.title}
        </p>
        {goal.desc && <p className="mt-0.5 text-sm leading-[1.6] text-text-muted">{goal.desc}</p>}
        {goal.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {goal.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** 单个阶段：左侧节点 + 右侧卡片（阶段信息与目标列表） */
function StageItem({
  stage,
  isLast,
}: {
  stage: PlanStage;
  isLast: boolean;
}) {
  const doneCount = stage.goals.filter((goal) => goal.status === 'done').length;

  return (
    <li className="relative pl-8">
      {/* 节点 */}
      <span
        className={`absolute left-0 top-[0.35rem] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${NODE_CLASS[stage.status]}`}
      >
        {stage.status === 'active' && (
          <span className="absolute inset-0 animate-ping rounded-full border border-[var(--color-accent)] opacity-60 motion-reduce:animate-none" />
        )}
        {stage.status === 'done' && <CheckIcon className="h-2 w-2 text-[var(--color-bg)]" />}
      </span>
      {/* 连接线（最后一项不画，避免尾部悬空；略微伸到下一节点下方，被节点圆点遮住） */}
      {!isLast && (
        <span
          className="absolute -bottom-[3rem] left-[0.4375rem] top-[1rem] w-px bg-[var(--color-border)]"
          aria-hidden="true"
        />
      )}

      <Reveal>
        <div className="rounded-xl border border-[var(--color-border-light)] bg-surface p-5 transition-colors hover:border-[var(--color-border)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-accent">{stage.period}</span>
            <StatusBadge status={stage.status} />
            <span className="ml-auto text-xs text-text-muted">
              {doneCount}/{stage.goals.length} 完成
            </span>
          </div>
          <h3 className="mt-1.5 text-lg font-semibold leading-snug text-[var(--color-text)]">
            {stage.title}
          </h3>
          {stage.summary && (
            <p className="mt-1 text-sm leading-[1.65] text-text-muted">{stage.summary}</p>
          )}
          {stage.goals.length > 0 && (
            <ul className="mt-4 space-y-3 border-t border-[var(--color-border-light)] pt-4">
              {stage.goals.map((goal) => (
                <GoalRow key={goal.title} goal={goal} />
              ))}
            </ul>
          )}
        </div>
      </Reveal>
    </li>
  );
}

/**
 * 成长规划的竖向时间轴
 *
 * 单侧左对齐：左侧一条竖线 + 状态节点，右侧阶段卡片；
 * 窄屏保持同一版式（只压缩间距），不做另一种布局。
 */
export default function PlanTimeline({ stages }: { stages: PlanStage[] }) {
  if (stages.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-border)] px-5 py-10 text-center text-sm text-text-muted">
        还没有规划内容，去管理后台「规划路线图」里添加第一个阶段吧。
      </p>
    );
  }

  return (
    <ol className="space-y-10">
      {stages.map((stage, i) => (
        <StageItem key={`${stage.period}-${String(i)}`} stage={stage} isLast={i === stages.length - 1} />
      ))}
    </ol>
  );
}
