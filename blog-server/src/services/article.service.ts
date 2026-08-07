import type { FilterQuery } from 'mongoose';

import { HttpError } from '../middleware/error.js';
import { Article, type ArticleDoc } from '../models/Article.js';
import { Comment } from '../models/Comment.js';
import { Tag } from '../models/Tag.js';
import { User } from '../models/User.js';
import { createNotification, resolveArticleRecipient } from './notification.service.js';
import { mdxToSafeHtml } from '../utils/mdx.js';
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
  // 列表查询排除了 likedBy/favoritedBy 大数组，用冗余计数；旧数据无计数时回退数组长度
  const likedBy = doc.likedBy ?? [];
  const favoritedBy = doc.favoritedBy ?? [];
  return {
    id: doc._id.toString(),
    title: doc.title,
    excerpt: doc.excerpt,
    tags: doc.tags,
    cover: doc.cover || undefined,
    date: formatDate(doc.createdAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    likes: doc.likes ?? likedBy.length,
    favorites: doc.favorites ?? favoritedBy.length,
    likedByMe: meKey !== undefined && likedBy.includes(meKey),
    favoritedByMe: meKey !== undefined && favoritedBy.includes(meKey),
  };
}

function toDetail(doc: ArticleDoc, meKey?: string): ArticleDetail {
  return { ...toListItem(doc, meKey), content: doc.content, contentHtml: doc.contentHtml ?? '' };
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
      // 列表页不需要正文（几十 KB 的大字段）与点赞/收藏大数组，用冗余计数
      .select('-content -contentHtml -likedBy -favoritedBy')
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
  const doc = await Article.findById(id).lean();
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  return toDetail(doc as unknown as ArticleDoc, currentUser ? likeKey(currentUser) : undefined);
}

/**
 * 点赞 / 取消点赞（原子操作，并发安全；新点赞时通知文章作者）
 *
 * 条件更新实现「点过则取消、没点过则点赞」：
 * - 尝试点赞：仅当 likedBy 不含 key（$ne）时 $addToSet + $inc 计数
 * - 未命中说明已点过 → 取消分支：仅当 likedBy 含 key 时 $pull + $inc 减一
 */
export async function toggleArticleLike(
  articleId: string,
  user: AuthUser,
): Promise<{ liked: boolean; likes: number }> {
  const key = likeKey(user);
  const liked = await Article.findOneAndUpdate(
    { _id: articleId, likedBy: { $ne: key } },
    { $addToSet: { likedBy: key }, $inc: { likes: 1 } },
    { new: true },
  );

  if (liked) {
    // 新点赞且非本人时，通知文章作者
    if (!(liked.authorType === user.role && liked.authorId?.toString() === user.id)) {
      const recipient = await resolveArticleRecipient(liked);
      if (recipient) {
        await createNotification({
          recipient,
          actor: user,
          type: 'like',
          articleId: liked._id.toString(),
          articleTitle: liked.title,
        });
      }
    }
    return { liked: true, likes: liked.likes };
  }

  // 已点过 → 取消
  const doc = await Article.findOneAndUpdate(
    { _id: articleId, likedBy: key },
    { $pull: { likedBy: key }, $inc: { likes: -1 } },
    { new: true },
  );
  if (!doc) {
    throw new HttpError(404, '文章不存在');
  }
  return { liked: false, likes: doc.likes };
}

/** 收藏 / 取消收藏（原子操作，并发安全；新收藏时通知文章作者） */
export async function toggleArticleFavorite(
  articleId: string,
  user: AuthUser,
): Promise<{ favorited: boolean; favorites: number }> {
  const key = likeKey(user);
  const favorited = await Article.findOneAndUpdate(
    { _id: articleId, favoritedBy: { $ne: key } },
    { $addToSet: { favoritedBy: key }, $inc: { favorites: 1 } },
    { new: true },
  );

  if (favorited) {
    // 新收藏且非本人时，通知文章作者（旧数据无作者时回退管理员）
    if (!(favorited.authorType === user.role && favorited.authorId?.toString() === user.id)) {
      const recipient = await resolveArticleRecipient(favorited);
      if (recipient) {
        await createNotification({
          recipient,
          actor: user,
          type: 'favorite',
          articleId: favorited._id.toString(),
          articleTitle: favorited.title,
        });
      }
    }
    return { favorited: true, favorites: favorited.favorites };
  }

  // 已收藏 → 取消
  const doc = await Article.findOneAndUpdate(
    { _id: articleId, favoritedBy: key },
    { $pull: { favoritedBy: key }, $inc: { favorites: -1 } },
    { new: true },
  );
  if (!doc) {
    throw new HttpError(404, '文章不存在');
  }
  return { favorited: false, favorites: doc.favorites };
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
  // 服务端编译 + 消毒正文，前端渲染 HTML（杜绝存储型 XSS）
  const contentHtml = await mdxToSafeHtml(input.content);
  const doc = await Article.create({
    ...input,
    contentHtml,
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
  const patch: UpdateArticleInput & { contentHtml?: string } = { ...input };
  if (patch.tags !== undefined) {
    const tags = normalizeTags(patch.tags);
    if (tags.length === 0) {
      throw new HttpError(400, '至少选择一个分类标签');
    }
    await assertTagsExist(tags);
    patch.tags = tags;
  }
  // 正文变更时重新编译消毒（不合法内容直接 400，不会覆盖旧数据）
  if (patch.content !== undefined) {
    patch.contentHtml = await mdxToSafeHtml(patch.content);
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
