/** 首页项目卡片 */
export interface HomeProject {
  name: string;
  desc: string;
  tags: string[];
}

/** 简历页项目经历 */
export interface ResumeProject {
  title: string;
  meta: string;
  desc: string[];
}
