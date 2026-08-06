import { useMemo } from 'react';

import { useSiteContentsQuery } from '@/hooks/queries';
import type { EducationItem, HomeProjectItem, ResumeProjectItem, SiteContentKey, SiteContentValue } from '@/types/api';

import EducationEditor from './EducationEditor';
import EvaluationEditor from './EvaluationEditor';
import HomeProjectEditor from './HomeProjectEditor';
import ResumeProjectEditor from './ResumeProjectEditor';
import SkillEditor from './SkillEditor';

/**
 * 简历与首页内容管理（堆叠在 /admin 管理页下方）
 *
 * 一次加载全部站点内容，按 key 分发给 5 个独立编辑器；
 * 每个编辑器独立保存（整体 PUT 对应 key），保存后自动刷新页面端数据。
 */
export default function SiteContentManager() {
  const contentsQuery = useSiteContentsQuery();

  const byKey = useMemo(() => {
    const map = new Map<SiteContentKey, SiteContentValue>();
    for (const item of contentsQuery.data ?? []) {
      map.set(item.key, item.value);
    }
    return map;
  }, [contentsQuery.data]);

  if (contentsQuery.isLoading) {
    return <p className="py-8 text-center text-text-muted">加载内容…</p>;
  }
  if (contentsQuery.isError) {
    return (
      <p className="rounded-lg border border-[var(--color-border-light)] bg-surface p-5 text-sm text-red-500">
        内容加载失败：{contentsQuery.error.message}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-[-0.02em]">简历与首页内容</h2>
        <p className="mt-1 text-sm text-text-muted">
          管理简历页（教育背景 / 专业技能 / 项目经历 / 个人评价）与首页「精选项目」，每个区块独立保存，保存后页面立即生效。
        </p>
      </div>
      <div className="grid gap-6">
        <EducationEditor value={byKey.get('education') as EducationItem[] | undefined} />
        <SkillEditor value={byKey.get('skills') as string[] | undefined} />
        <ResumeProjectEditor value={byKey.get('resumeProjects') as ResumeProjectItem[] | undefined} />
        <EvaluationEditor value={byKey.get('evaluation') as string | undefined} />
        <HomeProjectEditor value={byKey.get('homeProjects') as HomeProjectItem[] | undefined} />
      </div>
    </div>
  );
}
