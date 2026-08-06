/** 首页项目卡片 */
export interface HomeProject {
  name: string;
  desc: string;
  tags: string[];
  /** 可选：项目仓库链接，为空则不显示跳转链接 */
  link?: string;
}

/** 简历页项目经历 */
export interface ResumeProject {
  title: string;
  meta: string;
  desc: string[];
}
