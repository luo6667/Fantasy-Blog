/**
 * 📘 lib/queryKeys.ts —— 查询键工厂（技术栈：TanStack Query）
 *
 * queryKey 是缓存的"地址"：同 key 的查询跨组件共享一份缓存，
 * mutation 成功后 invalidateQueries(同前缀 key)即可让相关查询自动刷新。
 * 所以 key 必须全局统一从本文件取，避免各组件手写字符串导致缓存对不上。
 */
export const articleKeys = {
  all: ['articles'] as const,
  list: (tag: string | null) => [...articleKeys.all, 'list', tag ?? 'all'] as const,
  detail: (id: string) => ['article', id] as const,
}

export const interactionKeys = {
  commenter: ['github-commenter'] as const,
  comments: (articleID: string) => ['article', articleID, 'comments'] as const,
  reactions: (articleID: string) => ['article', articleID, 'reactions'] as const,
}

/** 主标签库（/tags） */
export const tagKeys = {
  all: ['tags'] as const,
}

/** 站点内容（/site-content） */
export const siteContentKeys = {
  all: ['site-content'] as const,
  byKey: (key: string) => [...siteContentKeys.all, key] as const,
}
