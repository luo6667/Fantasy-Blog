import type { PlanContent, PlanGoal, PlanItemStatus, PlanStage } from '@/types/api';

export type PlanProgress = {
  done: number;
  total: number;
  percent: number;
  status: PlanItemStatus;
};

function normalizeStatus(value: unknown): PlanItemStatus {
  return value === 'active' || value === 'done' ? value : 'planned';
}

function normalizeGoal(value: unknown, stageIndex: number, goalIndex: number): PlanGoal {
  const raw = value && typeof value === 'object' ? value as Partial<PlanGoal> : {};
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `goal-${String(stageIndex)}-${String(goalIndex)}`,
    title: typeof raw.title === 'string' ? raw.title : '',
    desc: typeof raw.desc === 'string' ? raw.desc : '',
    status: normalizeStatus(raw.status),
  };
}

/**
 * 运行时兼容层：旧部署中的 plan 是数组，不能仅靠 TypeScript 断言转换。
 * 遇到旧结构时回退到新结构的默认内容；新结构中个别缺失字段则安全归一化。
 */
export function normalizePlanContent(value: unknown, fallback: PlanContent): PlanContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const raw = value as Partial<PlanContent>;
  if (!Array.isArray(raw.stages)) return fallback;
  const stages = raw.stages as unknown[];

  return {
    title: typeof raw.title === 'string' ? raw.title : fallback.title,
    summary: typeof raw.summary === 'string' ? raw.summary : fallback.summary,
    stages: stages.map((stage, stageIndex) => {
      const item = stage && typeof stage === 'object' ? stage as Partial<PlanStage> : {};
      return {
        id: typeof item.id === 'string' && item.id ? item.id : `stage-${String(stageIndex)}`,
        order: typeof item.order === 'number' && Number.isInteger(item.order) && item.order > 0 ? item.order : stageIndex + 1,
        title: typeof item.title === 'string' ? item.title : '',
        summary: typeof item.summary === 'string' ? item.summary : '',
        goals: Array.isArray(item.goals)
          ? item.goals.map((goal, goalIndex) => normalizeGoal(goal, stageIndex, goalIndex))
          : [],
        current: item.current === true,
      };
    }),
  };
}

export function sortPlanStages(stages: PlanStage[]): PlanStage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

/** 阶段与总目标的进度均由子目标状态推导，避免手动状态与实际完成情况不一致。 */
export function calculateProgress(goals: PlanStage['goals']): PlanProgress {
  const total = goals.length;
  const done = goals.filter((goal) => goal.status === 'done').length;
  const hasActive = goals.some((goal) => goal.status === 'active');

  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    status: total > 0 && done === total ? 'done' : hasActive || done > 0 ? 'active' : 'planned',
  };
}

export function calculatePlanProgress(content: PlanContent): PlanProgress {
  return calculateProgress(content.stages.flatMap((stage) => stage.goals));
}

/** 后台手动指定优先；未指定时优先进行中，其次第一个尚未开始的阶段。 */
export function findCurrentStage(content: PlanContent): PlanStage | undefined {
  const stages = sortPlanStages(content.stages);
  return stages.find((stage) => stage.current === true)
    ?? stages.find((stage) => calculateProgress(stage.goals).status === 'active')
    ?? stages.find((stage) => calculateProgress(stage.goals).status === 'planned');
}
