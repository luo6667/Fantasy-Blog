import type { FilterQuery } from 'mongoose';

import { HttpError } from '../middleware/error.js';
import { Article, type ArticleDoc } from '../models/Article.js';
import { Comment } from '../models/Comment.js';
import { Tag } from '../models/Tag.js';
import { User } from '../models/User.js';
import { createNotification, resolveArticleRecipient } from './notification.service.js';
import type { AuthUser } from '../types/auth.js';
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
 * listArticles：分页 + 标签筛选 + 关键字搜索（公开）
 * getArticle：详情（公开，返回当前用户点赞/收藏状态）
 * toggleLike / toggleFavorite：点赞 / 收藏（登录）
 * listFavoriteArticles：我的收藏（登录）
 * create/update/delete：增删改（由 requireAuth 中间件保护）
 */

/** 列表查询参数 */
export interface ArticleListQuery {
  page: number;
  pageSize: number;
  tag?: string;
  search?: string;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 转义正则特殊字符，用于用户输入搜索 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "role:id" 用户标识 */
export function likeKey(user: AuthUser): string {
  return `${user.role}:${user.id}`;
}

function toListItem(doc: ArticleDoc, meKey?: string): ArticleListItem {
  return {
    id: doc._id.toString(),
    title: doc.title,
    excerpt: doc.excerpt,
    tags: doc.tags,
    cover: doc.cover || undefined,
    date: formatDate(doc.createdAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    likes: doc.likedBy.length,
    favorites: doc.favoritedBy.length,
    likedByMe: meKey !== undefined && doc.likedBy.includes(meKey),
    favoritedByMe: meKey !== undefined && doc.favoritedBy.includes(meKey),
  };
}

function toDetail(doc: ArticleDoc, meKey?: string): ArticleDetail {
  return { ...toListItem(doc, meKey), content: doc.content };
}

/** 分页查询文章列表（支持标签筛选与关键字搜索） */
export async function listArticles(
  query: ArticleListQuery,
  currentUser?: AuthUser,
): Promise<PaginatedResult<ArticleListItem>> {
  const { page, pageSize, tag, search } = query;
  const filter: FilterQuery<ArticleDoc> = {};
  if (tag) {
    filter.tags = tag;
  }
  if (search && search.trim() !== '') {
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ title: rx }, { excerpt: rx }, { content: rx }];
  }

  const [total, docs] = await Promise.all([
    Article.countDocuments(filter),
    Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ]);
  const meKey = currentUser ? likeKey(currentUser) : undefined;

  return {
    list: docs.map((d) => toListItem(d, meKey)),
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
export async function getArticle(id: string, currentUser?: AuthUser): Promise<ArticleDetail> {
  const doc = await Article.findById(id);
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  return toDetail(doc, currentUser ? likeKey(currentUser) : undefined);
}

/** 点赞 / 取消点赞（新点赞时通知文章作者），返回最新状态 */
export async function toggleArticleLike(
  articleId: string,
  user: AuthUser,
): Promise<{ liked: boolean; likes: number }> {
  const key = likeKey(user);
  const doc = await Article.findById(articleId);
  if (!doc) {
    throw new HttpError(404, '文章不存在');
  }
  const liked = doc.likedBy.includes(key);
  if (liked) {
    doc.likedBy = doc.likedBy.filter((k) => k !== key);
  } else {
    doc.likedBy.push(key);
  }
  await doc.save();

  // 新点赞且非本人时，通知文章作者
  if (
    !liked &&
    !(doc.authorType === user.role && doc.authorId?.toString() === user.id)
  ) {
    const recipient = await resolveArticleRecipient(doc);
    if (recipient) {
      await createNotification({
        recipient,
        actor: user,
        type: 'like',
        articleId: doc._id.toString(),
        articleTitle: doc.title,
      });
    }
  }

  return { liked: !liked, likes: doc.likedBy.length };
}

/** 收藏 / 取消收藏；新收藏时通知文章作者 */
export async function toggleArticleFavorite(
  articleId: string,
  user: AuthUser,
): Promise<{ favorited: boolean; favorites: number }> {
  const key = likeKey(user);
  const doc = await Article.findById(articleId);
  if (!doc) {
    throw new HttpError(404, '文章不存在');
  }
  const favorited = doc.favoritedBy.includes(key);
  if (favorited) {
    doc.favoritedBy = doc.favoritedBy.filter((k) => k !== key);
  } else {
    doc.favoritedBy.push(key);
  }
  await doc.save();

  // 新收藏且非本人时，通知文章作者（旧数据无作者时回退管理员）
  if (
    !favorited &&
    !(doc.authorType === user.role && doc.authorId?.toString() === user.id)
  ) {
    const recipient = await resolveArticleRecipient(doc);
    if (recipient) {
      await createNotification({
        recipient,
        actor: user,
        type: 'favorite',
        articleId: doc._id.toString(),
        articleTitle: doc.title,
      });
    }
  }

  return { favorited: !favorited, favorites: doc.favoritedBy.length };
}

/** 我收藏的文章列表 */
export async function listFavoriteArticles(user: AuthUser): Promise<ArticleListItem[]> {
  const meKey = likeKey(user);
  const docs = await Article.find({ favoritedBy: meKey }).sort({ createdAt: -1 }).lean();
  return docs.map((d) => toListItem(d, meKey));
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

/** 创建文章（记录作者，供通知使用） */
export async function createArticle(
  input: CreateArticleInput,
  author: AuthUser,
): Promise<ArticleDetail> {
  const tags = normalizeTags(input.tags ?? []);
  if (tags.length === 0) {
    throw new HttpError(400, '至少选择一个分类标签');
  }
  await assertTagsExist(tags);
  const doc = await Article.create({
    ...input,
    tags,
    authorType: author.role,
    authorId: author.id,
    authorName: author.username,
  });

  // 新文章发布：通知所有普通用户（发布者本身不通知）
  const users = await User.find({}).select('_id').lean();
  const recipients = users.filter((u) => !(author.role === 'user' && u._id.toString() === author.id));
  await Promise.all(
    recipients.map((u) =>
      createNotification({
        recipient: { role: 'user', id: u._id.toString() },
        actor: author,
        type: 'article',
        articleId: doc._id.toString(),
        articleTitle: doc.title,
      }),
    ),
  );

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
