/**
 * 后端 API 数据类型（与 blog-server 的响应结构对齐）
 */

/** 后端统一返回结构：{ code, msg, data } */
export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

/** 文章列表项（不含正文） */
export interface ArticleListItem {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  cover?: string;
  /** 发布日期 YYYY-MM-DD */
  date: string;
  createdAt: string;
  updatedAt: string;
}

/** 文章详情（含正文） */
export interface ArticleDetail extends ArticleListItem {
  content: string;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 标签及文章数（博客页筛选栏用） */
export interface TagCount {
  name: string;
  count: number;
}

/** 标签库标签项 */
export interface TagItem {
  id: string;
  name: string;
  /** 使用该标签的文章数 */
  count: number;
}

/** 身份角色 */
export type UserRole = 'user' | 'admin';

/** 登录用户信息 */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

/** 登录响应 */
export interface LoginResult {
  token: string;
  user: AuthUser;
}

/** 评论项（含点赞状态） */
export interface CommentItem {
  id: string;
  articleId: string;
  /** 父评论 id；一级评论为 null */
  parentId: string | null;
  authorName: string;
  authorType: UserRole;
  /** 被回复者名字（一级评论为 null），用于「谁回复谁」展示 */
  replyToName: string | null;
  content: string;
  likes: number;
  /** 当前登录用户是否已点赞 */
  likedByMe: boolean;
  /** 当前登录用户是否为作者本人 */
  mine: boolean;
  createdAt: string;
}

/** 创建/更新文章请求体 */
export interface ArticleInput {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  cover?: string;
}

/** 上传响应 */
export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}
