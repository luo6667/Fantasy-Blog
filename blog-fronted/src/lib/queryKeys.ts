/**
 * 全局查询键工厂
 *
 * queryKey 全站统一从这里取值，保证：
 * - 同一份数据的查询在各组件间共享缓存（如文章列表、标签库、文章详情）
 * - mutation 后可精确失效对应查询，自动刷新
 */

/** 文章相关：列表 / 详情 / 标签计数（/articles/tags） */
/**
 * TanStack Query 缓存键中心。
 *
 * 原理:queryKey 是缓存的"地址",同 key 的查询跨组件共享一份缓存;
 * mutation 成功后 invalidateQueries(同前缀 key)即可让相关查询自动刷新。
 * 所以 key 必须全局统一从本文件取,避免各组件手写字符串导致缓存对不上。
 */
export const articleKeys = {
  all: ['articles'] as const,
  list: (tag: string | null) => [...articleKeys.all, 'list', tag ?? 'all'] as const,
  detail: (id: string) => ['article', id] as const,
  tags: ['article-tags'] as const,
};

/** 标签库（/tags） */
export const tagKeys = {
  all: ['tags'] as const,
};

/** 站点内容（/site-content） */
export const siteContentKeys = {
  all: ['site-content'] as const,
  byKey: (key: string) => [...siteContentKeys.all, key] as const,
};

/** 评论（按文章 + 当前用户隔离：mine / likedByMe 随登录态变化） */
export const commentKeys = {
  all: ['comments'] as const,
  byArticle: (articleId: string, userId?: string) =>
    [...commentKeys.all, articleId, userId ?? 'guest'] as const,
};
