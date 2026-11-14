/**
 * 后端 API 数据类型（与 blog-server 的响应结构对齐）
 */

/** 后端统一返回结构：{ code, msg, data } */
export interface ApiEnvelope<T> {
  code: number
  msg: string
  data: T
}

/** 主标签（文章唯一的分类标签） */
export interface PrimaryTag {
  id: string
  name: string
}

/** 文章列表项（不含正文） */
export interface ArticleListItem {
  id: string
  title: string
  excerpt: string
  /** 主标签：每篇文章必须且只能有一个 */
  primaryTag: PrimaryTag
  /** 子标签：文章内自由维护的字符串，仅用于展示与检索 */
  subTags: string[]
  cover?: string
  /** 发布日期 YYYY-MM-DD */
  date: string
  createdAt: string
  updatedAt: string
}

/** 文章详情（含正文） */
export interface ArticleDetail extends ArticleListItem {
  /** 正文 MDX 源码（编辑器用） */
  content: string
  /** 服务端编译并消毒后的正文 HTML（渲染用） */
  contentHtml: string
  /** Markdown H2-H3 生成的正文目录。 */
  toc?: ArticleHeading[]
}

export interface ArticleHeading {
  id: string
  level: 2 | 3
  text: string
}

export interface GitHubCommenter {
  id: string
  login: string
  name: string
  avatarUrl: string
  profileUrl: string
}

export interface ArticleComment {
  id: string
  articleId: string
  author: GitHubCommenter
  content: string
  createdAt: string
  updatedAt: string
}

export interface AdminArticleComment extends ArticleComment {
  articleTitle: string
}

export type ReactionType = 'love' | 'confused' | 'correction'

export interface ReactionSummary {
  love: number
  confused: number
  correction: number
  current: ReactionType | null
}

/** 分页结果 */
export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 标签库标签项（主标签 + 使用该标签的文章数） */
export interface TagItem {
  id: string
  name: string
  count: number
}

/** 登录用户信息（仅管理员） */
export interface AuthUser {
  id: string
  username: string
  role: 'admin'
}

/** 登录响应 */
export interface LoginResult {
  token: string
  user: AuthUser
}

/** 创建/更新文章请求体 */
export interface ArticleInput {
  title: string
  excerpt: string
  content: string
  /** 主标签 id（必填） */
  primaryTagId: string
  /** 子标签（可空，后端会 trim/去重） */
  subTags: string[]
  cover?: string
}

/** 上传响应 */
export interface UploadResult {
  url: string
  filename: string
  size: number
  mimetype: string
}

/** 站点内容 key：简历页内容 + 首页精选项目 + 规划页路线图 */
export type SiteContentKey =
  'education' | 'skills' | 'internships' | 'resumeProjects' | 'evaluation' | 'homeProjects' | 'plan'

/** 教育背景项 */
export interface EducationItem {
  year: string
  title: string
  school: string
  desc: string
}

/** 简历页项目经历项 */
export interface ResumeProjectItem {
  title: string
  meta: string
  desc: string[]
}

/** 简历页实习经历项 */
export interface InternshipItem {
  company: string
  role: string
  period: string
  desc: string[]
}

/** 首页精选项目项 */
export interface HomeProjectItem {
  name: string
  /** 首页一两句价值说明 */
  summary: string
  /** 旧字段：历史数据只有 desc，读取时回退到 summary */
  desc?: string
  /** 分类，如「产品实验」「内容系统」 */
  category: string
  /** 年份，如「2026」 */
  year: string
  /** 封面图 URL；为空时首页渲染生成的抽象封面 */
  cover: string
  /** 封面图 alt 文本 */
  coverAlt: string
  tags: string[]
  /** 可选：项目仓库或线上预览链接 */
  link?: string
  /** 可选：外链文案，如「查看项目」 */
  linkLabel?: string
  /** 是否进入首页精选 */
  featured: boolean
  /** 排序，越小越靠前 */
  order: number
}

/** 规划条目状态：未开始 / 进行中 / 已完成 */
export type PlanItemStatus = 'planned' | 'active' | 'done'

/** 阶段性目标下可独立完成的子目标。 */
export interface PlanGoal {
  id: string
  title: string
  desc: string
  status: PlanItemStatus
}

/** 一个总目标下的阶段性目标；状态和进度由子目标实时计算，不写入数据。 */
export interface PlanStage {
  id: string
  /** 阶段展示顺序；后台可编辑，公开页按此升序排列。 */
  order: number
  title: string
  summary: string
  goals: PlanGoal[]
  /** 后台手动指定的当前阶段；同一时间最多一个为 true，缺省时按推进状态自动推导。 */
  current?: boolean
}

/** 规划页唯一的总目标。 */
export interface PlanContent {
  title: string
  summary: string
  stages: PlanStage[]
}

/** 各 key 对应的内容值 */
export type SiteContentValue =
  | EducationItem[]
  | string[]
  | InternshipItem[]
  | ResumeProjectItem[]
  | string
  | HomeProjectItem[]
  | PlanContent

/** 站点内容项 */
export interface SiteContentItem {
  id: string
  key: SiteContentKey
  value: SiteContentValue
  updatedAt: string
}
