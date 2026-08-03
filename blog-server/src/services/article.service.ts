import type { FilterQuery } from 'mongoose';

import { HttpError } from '../middleware/error.js';
import { Article, type ArticleDoc } from '../models/Article.js';
import { Comment } from '../models/Comment.js';
import { Tag } from '../models/Tag.js';
import type {
  ArticleDetail,
  ArticleListItem,
  CreateArticleInput,
  PaginatedResult,
  TagCount,
  UpdateArticleInput,
} from '../types/article.js';

/**
 * 文章业务逻辑
 *
 * listArticles：分页 + 标签筛选（公开）
 * getArticle：详情（公开）
 * create/update/delete：增删改（由 requireAuth 中间件保护）
 */

/** 列表查询参数 */
export interface ArticleListQuery {
  page: number;
  pageSize: number;
  tag?: string;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toListItem(doc: ArticleDoc): ArticleListItem {
  return {
    id: doc._id.toString(),
    title: doc.title,
    excerpt: doc.excerpt,
    tags: doc.tags,
    cover: doc.cover || undefined,
    date: formatDate(doc.createdAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toDetail(doc: ArticleDoc): ArticleDetail {
  return { ...toListItem(doc), content: doc.content };
}

/** 分页查询文章列表 */
export async function listArticles(query: ArticleListQuery): Promise<PaginatedResult<ArticleListItem>> {
  const { page, pageSize, tag } = query;
  const filter: FilterQuery<ArticleDoc> = {};
  if (tag) {
    filter.tags = tag;
  }

  const [total, docs] = await Promise.all([
    Article.countDocuments(filter),
    Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    list: docs.map(toListItem),
    total,
    page,
    pageSize,
  };
}

/** 获取全部标签及文章数（按文章数降序） */
export async function listTags(): Promise<TagCount[]> {
  const rows = await Article.aggregate<{ _id: string; count: number }>([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((r) => ({ name: r._id, count: r.count }));
}

/** 文章详情 */
export async function getArticle(id: string): Promise<ArticleDetail> {
  const doc = await Article.findById(id);
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  return toDetail(doc);
}

/** 去重后的标签（去掉空白与重复） */
function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

/** 校验标签必须存在于标签库（管理员需先添加标签） */
async function assertTagsExist(tags: string[]): Promise<void> {
  const uniq = [...new Set(tags)];
  const found = await Tag.find({ name: { $in: uniq } }).select('name').lean();
  const foundSet = new Set(found.map((t) => t.name));
  const missing = uniq.filter((t) => !foundSet.has(t));
  if (missing.length > 0) {
    throw new HttpError(400, `标签「${missing.join('、')}」不存在，请先在标签库中添加`);
  }
}

/** 创建文章 */
export async function createArticle(input: CreateArticleInput): Promise<ArticleDetail> {
  const tags = normalizeTags(input.tags ?? []);
  if (tags.length === 0) {
    throw new HttpError(400, '至少选择一个分类标签');
  }
  await assertTagsExist(tags);
  const doc = await Article.create({ ...input, tags });
  return toDetail(doc);
}

/** 更新文章（部分字段） */
export async function updateArticle(id: string, input: UpdateArticleInput): Promise<ArticleDetail> {
  const patch: UpdateArticleInput = { ...input };
  if (patch.tags !== undefined) {
    const tags = normalizeTags(patch.tags);
    if (tags.length === 0) {
      throw new HttpError(400, '至少选择一个分类标签');
    }
    await assertTagsExist(tags);
    patch.tags = tags;
  }
  const doc = await Article.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  return toDetail(doc);
}

/** 删除文章（连带删除其全部评论） */
export async function deleteArticle(id: string): Promise<{ id: string }> {
  const doc = await Article.findByIdAndDelete(id);
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  // 级联删除该文章下的所有评论与回复，避免孤儿数据
  await Comment.deleteMany({ article: doc._id });
  return { id: doc._id.toString() };
}
