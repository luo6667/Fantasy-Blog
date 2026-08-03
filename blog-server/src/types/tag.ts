/**
 * 标签相关类型
 *
 * 标签库是分类标签的权威来源（Tag 集合），
 * 文章里的 tags 数组从中选取；/api/tags 支持管理员增删。
 */

/** 标签列表项 */
export interface TagItem {
  id: string;
  name: string;
  /** 使用该标签的文章数 */
  count: number;
}
