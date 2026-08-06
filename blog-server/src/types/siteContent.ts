/**
 * 站点内容类型（简历页 + 首页精选项目）
 *
 * 简历页 / 首页的展示内容不再硬编码在前端，而是存入 SiteContent 集合，
 * 按 key 存取 JSON 值，管理员可在管理后台增删改。
 */

/** 内容块 key：简历页 4 块 + 首页精选项目 */
export type SiteContentKey =
  | 'education'
  | 'skills'
  | 'resumeProjects'
  | 'evaluation'
  | 'homeProjects';

/** 教育背景项 */
export interface EducationItem {
  year: string;
  title: string;
  school: string;
  desc: string;
}

/** 简历页项目经历项 */
export interface ResumeProjectItem {
  title: string;
  meta: string;
  desc: string[];
}

/** 首页精选项目项 */
export interface HomeProjectItem {
  name: string;
  desc: string;
  tags: string[];
  /** 可选：项目仓库链接（https:// 或 git@…），为空则不显示跳转链接 */
  link?: string;
}

/** 各 key 对应的内容值 */
export type SiteContentValue =
  | EducationItem[]
  | string[]
  | ResumeProjectItem[]
  | string
  | HomeProjectItem[];

/** 站点内容项（API 返回） */
export interface SiteContentItem {
  id: string;
  key: SiteContentKey;
  value: SiteContentValue;
  updatedAt: string;
}

/** 全部内容 key（路由校验与 seed 用） */
export const SITE_CONTENT_KEYS: SiteContentKey[] = [
  'education',
  'skills',
  'resumeProjects',
  'evaluation',
  'homeProjects',
];

/** key → 值类型的类型映射（方便按 key 取具体类型） */
export interface SiteContentValueMap {
  education: EducationItem[];
  skills: string[];
  resumeProjects: ResumeProjectItem[];
  evaluation: string;
  homeProjects: HomeProjectItem[];
}
