import { HOME_PROJECTS } from '@/constants/home';
import { PLAN_STAGES } from '@/constants/plan';
import {
  RESUME_EDUCATION,
  RESUME_EVALUATION,
  RESUME_PROJECTS,
  RESUME_SKILLS,
} from '@/constants/resume';
import type { SiteContentKey, SiteContentValue } from '@/types/api';

/**
 * 📘 lib/siteContentFallbacks.ts —— 站点内容默认值（服务端预取失败时兜底）
 *
 * 页面 SSR prefetch 失败（后端未启动 / 超时）时，若只吞掉错误，服务端会渲染默认常量，
 * 而客户端 useQuery 稍后拿到数据库内容，两边首屏不一致会触发 hydration mismatch。
 * 因此失败时把同一份默认值写进 QueryClient，让 dehydrate 的 HTML 与客户端首屏一致；
 * 数据后续仍会在 staleTime 之后重新拉取。
 */
export const SITE_CONTENT_FALLBACKS: Record<SiteContentKey, SiteContentValue> = {
  education: RESUME_EDUCATION,
  skills: RESUME_SKILLS,
  resumeProjects: RESUME_PROJECTS,
  evaluation: RESUME_EVALUATION,
  homeProjects: HOME_PROJECTS,
  plan: PLAN_STAGES,
};
