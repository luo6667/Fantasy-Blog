'use client';

import { useSiteContentsQuery } from '@/hooks/queries';
import type {
  EducationItem,
  HomeProjectItem,
  PlanStage,
  ResumeProjectItem,
  SiteContentKey,
  SiteContentValue,
} from '@/types/api';

import EducationEditor from './EducationEditor';
import EvaluationEditor from './EvaluationEditor';
import HomeProjectEditor from './HomeProjectEditor';
import PlanEditor from './PlanEditor';
import ResumeProjectEditor from './ResumeProjectEditor';
import SkillEditor from './SkillEditor';

/** 站点内容加载与分发（每个编辑器整体 PUT 自己的 key，保存后自动刷新页面端数据） */
function useContentMap() {
  const contentsQuery = useSiteContentsQuery();
  const map = new Map<SiteContentKey, SiteContentValue>();
  for (const item of contentsQuery.data ?? []) {
    map.set(item.key, item.value);
  }
  return { contentsQuery, map };
}

function LoadingState({ error, loading }: { error?: string; loading: boolean }) {
  if (loading) return <p className="py-8 text-center text-text-muted">加载内容…</p>;
  if (error) {
    return (
      <p className="rounded-lg border border-[var(--color-border-light)] bg-surface p-5 text-sm text-red-500">
        内容加载失败：{error}
      </p>
    );
  }
  return null;
}

/** 规划管理（/admin/plan）：成长路线图 */
export function PlanContentManager() {
  const { contentsQuery, map } = useContentMap();
  if (contentsQuery.isLoading || contentsQuery.error) {
    return (
      <LoadingState loading={contentsQuery.isLoading} error={contentsQuery.error?.message} />
    );
  }
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">规划管理</h1>
        <p className="mt-1 text-sm text-text-muted">
          管理规划页「成长规划」的阶段与目标，保存后页面立即生效。
        </p>
      </div>
      <PlanEditor value={map.get('plan') as PlanStage[] | undefined} />
    </div>
  );
}

/** 简历管理（/admin/resume）：教育背景 / 专业技能 / 项目经历 / 个人评价 + 首页精选项目 */
export function ResumeContentManager() {
  const { contentsQuery, map } = useContentMap();
  if (contentsQuery.isLoading || contentsQuery.error) {
    return (
      <LoadingState loading={contentsQuery.isLoading} error={contentsQuery.error?.message} />
    );
  }
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">简历管理</h1>
        <p className="mt-1 text-sm text-text-muted">
          管理简历页各区块与首页「精选项目」，每个区块独立保存，保存后页面立即生效。
        </p>
      </div>
      <div className="grid gap-6">
        <EducationEditor value={map.get('education') as EducationItem[] | undefined} />
        <SkillEditor value={map.get('skills') as string[] | undefined} />
        <ResumeProjectEditor value={map.get('resumeProjects') as ResumeProjectItem[] | undefined} />
        <EvaluationEditor value={map.get('evaluation') as string | undefined} />
        <HomeProjectEditor value={map.get('homeProjects') as HomeProjectItem[] | undefined} />
      </div>
    </div>
  );
}

/** 全量站点内容（保留给需要一次管理全部内容的场景） */
export default function SiteContentManager() {
  const { contentsQuery, map } = useContentMap();
  if (contentsQuery.isLoading || contentsQuery.error) {
    return (
      <LoadingState loading={contentsQuery.isLoading} error={contentsQuery.error?.message} />
    );
  }
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-[-0.02em]">站点内容管理</h2>
        <p className="mt-1 text-sm text-text-muted">
          管理简历页（教育背景 / 专业技能 / 项目经历 / 个人评价）、首页「精选项目」与规划页「成长规划」，每个区块独立保存，保存后页面立即生效。
        </p>
      </div>
      <div className="grid gap-6">
        <EducationEditor value={map.get('education') as EducationItem[] | undefined} />
        <SkillEditor value={map.get('skills') as string[] | undefined} />
        <ResumeProjectEditor value={map.get('resumeProjects') as ResumeProjectItem[] | undefined} />
        <EvaluationEditor value={map.get('evaluation') as string | undefined} />
        <HomeProjectEditor value={map.get('homeProjects') as HomeProjectItem[] | undefined} />
        <PlanEditor value={map.get('plan') as PlanStage[] | undefined} />
      </div>
    </div>
  );
}
