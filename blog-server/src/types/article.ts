/**
 * 文章相关类型
 *
 * 对外返回结构：列表项不含正文，详情含正文（content）。
 */

/** 创建文章请求体 */
export interface CreateArticleInput {
  title: string;
  excerpt: string;
  content: string;
  tags?: string[];
  cover?: string;
}

/** 更新文章请求体（部分字段） */
export type UpdateArticleInput = Partial<CreateArticleInput>;

/** 文章列表项（不含正文） */
export interface ArticleListItem {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  cover?: string;
  /** 发布日期 YYYY-MM-DD（取 createdAt） */
  date: string;
  createdAt: string;
  updatedAt: string;
  /** 点赞数 */
  likes: number;
  /** 收藏数 */
  favorites: number;
  /** 当前登录用户是否已点赞（未登录恒为 false） */
  likedByMe: boolean;
  /** 当前登录用户是否已收藏（未登录恒为 false） */
  favoritedByMe: boolean;
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

/** 标签及文章数（列表页筛选栏用） */
export interface TagCount {
  name: string;
  count: number;
}
