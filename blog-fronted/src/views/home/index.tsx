'use client';

import { HOME_PROJECTS } from '@/constants/home';
import { useSiteContentQuery } from '@/hooks/queries';
import type { GitHubContributionsData } from '@/lib/github';
import { SITE_CONTENT_FALLBACKS } from '@/lib/siteContentFallbacks';
import type { ArticleListItem, HomeProjectItem, PlanStage } from '@/types/api';

import Hero from './Hero';
import InProgress from './InProgress';
import Practice from './Practice';
import SelectedWork from './SelectedWork';

/**
 * 首页（杂志式布局）
 *
 * 作品优先：Hero 只讲在做什么，随后是精选项目、持续创作、正在构建。
 * 数据全部来自站点内容与文章接口，服务端已预取；失败时回退到默认常量，
 * 保证首屏与客户端一致（详见 lib/siteContentFallbacks.ts）。
 */
export default function HomeView({
  contributions,
  recentPosts,
}: {
  contributions: GitHubContributionsData | null;
  recentPosts: ArticleListItem[];
}) {
  const { data: projectsData } = useSiteContentQuery('homeProjects');
  const { data: planData } = useSiteContentQuery('plan');

  const projects = ((projectsData?.value as StoredProject[] | undefined) ?? HOME_PROJECTS).map(
    normalizeProject,
  );
  const plan =
    (planData?.value as PlanStage[] | undefined) ?? (SITE_CONTENT_FALLBACKS.plan as PlanStage[]);

  const featured = projects
    .filter((project) => project.featured)
    .sort((a, b) => a.order - b.order)
    .slice(0, 4);

  return (
    <>
      <Hero />
      <SelectedWork projects={featured} />
      <Practice contributions={contributions} posts={recentPosts} />
      <InProgress stages={plan} />
    </>
  );
}

/** 兼容旧数据：只有 name/desc/tags 时回退到 desc，并补齐 featured/order */
type StoredProject = Partial<HomeProjectItem> & { name: string; desc?: string };

function normalizeProject(project: StoredProject, index: number): HomeProjectItem {
  return {
    name: project.name,
    summary: project.summary ?? project.desc ?? '',
    category: project.category ?? '',
    year: project.year ?? '',
    cover: project.cover ?? '',
    coverAlt: project.coverAlt ?? '',
    tags: project.tags ?? [],
    link: project.link,
    linkLabel: project.linkLabel,
    featured: project.featured ?? true,
    order: project.order ?? index + 1,
  };
}
