import { literal, Op, QueryTypes, type WhereOptions } from 'sequelize';

import { sequelize } from '../db/sequelize.js';
import { HttpError } from '../middleware/error.js';
import Article from '../models/Article.js';
import Comment from '../models/Comment.js';
import Tag from '../models/Tag.js';
import User from '../models/User.js';
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

/** 转义 LIKE 通配符（用户输入搜索），MySQL LIKE 默认大小写不敏感 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** JSON 数组列包含指定字符串值（等价 MongoDB 的 { field: value } 数组匹配） */
function jsonContains(column: string, value: string) {
  return literal(`JSON_CONTAINS(${column}, JSON_QUOTE(${sequelize.escape(value)}))`);
}

/** "role:id" 用户标识 */
export function likeKey(user: AuthUser): string {
  return `${user.role}:${user.id}`;
}

function toListItem(doc: Article, meKey?: string): ArticleListItem {
  // 列表查询排除了 content/contentHtml/likedBy/favoritedBy 大字段，用冗余计数
  const likedBy = doc.likedBy ?? [];
  const favoritedBy = doc.favoritedBy ?? [];
  return {
    id: doc.id,
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

function toDetail(doc: Article, meKey?: string): ArticleDetail {
  return { ...toListItem(doc, meKey), content: doc.content, contentHtml: doc.contentHtml ?? '' };
}

/** 分页查询文章列表（支持标签筛选与关键字搜索） */
export async function listArticles(
  query: ArticleListQuery,
  currentUser?: AuthUser,
): Promise<PaginatedResult<ArticleListItem>> {
  const { page, pageSize, tag, search } = query;
  const where: WhereOptions = {};
  if (tag) {
    Object.assign(where, { [Op.and]: [jsonContains('tags', tag)] });
  }
  if (search && search.trim() !== '') {
    const kw = escapeLike(search.trim());
    Object.assign(where, {
      [Op.or]: [
        { title: { [Op.like]: `%${kw}%` } },
        { excerpt: { [Op.like]: `%${kw}%` } },
        { content: { [Op.like]: `%${kw}%` } },
      ],
    });
  }

  const [total, docs] = await Promise.all([
    Article.count({ where }),
    Article.findAll({
      where,
      // 列表页不需要正文（几十 KB 的大字段）与点赞/收藏大数组，用冗余计数
      attributes: { exclude: ['content', 'contentHtml', 'likedBy', 'favoritedBy'] },
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
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
  const rows = await sequelize.query<{ tag: string; cnt: number }>(
    `SELECT jt.tag AS tag, COUNT(*) AS cnt
     FROM articles, JSON_TABLE(articles.tags, '$[*]' COLUMNS (tag VARCHAR(64) PATH '$')) AS jt
     GROUP BY jt.tag
     ORDER BY cnt DESC, tag ASC`,
    { type: QueryTypes.SELECT },
  );
  return rows.map((r) => ({ name: r.tag, count: Number(r.cnt) }));
}

/** 文章详情 */
export async function getArticle(id: string, currentUser?: AuthUser): Promise<ArticleDetail> {
  const doc = await Article.findByPk(id);
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  return toDetail(doc, currentUser ? likeKey(currentUser) : undefined);
}

/**
 * 点赞 / 取消点赞（原子操作，并发安全；新点赞时通知文章作者）
 *
 * 用事务 + 行锁（SELECT ... FOR UPDATE）实现「点过则取消、没点过则点赞」，
 * 语义与旧 MongoDB 的条件更新（$addToSet + $inc / $pull + $inc）一致。
 */
export async function toggleArticleLike(
  articleId: string,
  user: AuthUser,
): Promise<{ liked: boolean; likes: number }> {
  const key = likeKey(user);
  const { liked, likes, article } = await sequelize.transaction(async (t) => {
    const doc = await Article.findByPk(articleId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!doc) {
      throw new HttpError(404, '文章不存在');
    }
    let likedNow: boolean;
    if (doc.likedBy.includes(key)) {
      doc.likedBy = doc.likedBy.filter((k) => k !== key);
      doc.likes -= 1;
      likedNow = false;
    } else {
      // 重新赋值触发 Sequelize 变更检测（原地 push 不会标记字段为已修改）
      doc.likedBy = [...doc.likedBy, key];
      doc.likes += 1;
      likedNow = true;
    }
    await doc.save({ transaction: t });
    return { liked: likedNow, likes: doc.likes, article: doc };
  });

  // 新点赞且非本人时，通知文章作者（事务外执行，避免通知与点赞不一致）
  if (liked && !(article.authorType === user.role && article.authorId === user.id)) {
    const recipient = await resolveArticleRecipient(article);
    if (recipient) {
      await createNotification({
        recipient,
        actor: user,
        type: 'like',
        articleId: article.id,
        articleTitle: article.title,
      });
    }
  }
  return { liked, likes };
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

/** 校验标签必须存在于标签库（管理员需先添加标签） */
async function assertTagsExist(tags: string[]): Promise<void> {
  const uniq = [...new Set(tags)];
  const found = await Tag.findAll({ where: { name: { [Op.in]: uniq } }, attributes: ['name'] });
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
    likedBy: [],
    favoritedBy: [],
    authorType: author.role,
    authorId: author.id,
    authorName: author.username,
  });

  // 新文章发布：通知所有普通用户（发布者本身不通知）
  const users = await User.findAll({ attributes: ['id'] });
  const recipients = users.filter((u) => !(author.role === 'user' && u.id === author.id));
  await Promise.all(
    recipients.map((u) =>
      createNotification({
        recipient: { role: 'user', id: u.id },
        actor: author,
        type: 'article',
        articleId: doc.id,
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

  const doc = await Article.findByPk(id);
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  // 只应用显式提供的字段（undefined 表示不更新），save 时自动校验
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) {
      (doc as unknown as Record<string, unknown>)[k] = v;
    }
  }
  await doc.save();
  return toDetail(doc);
}

/** 删除文章（连带删除其全部评论） */
export async function deleteArticle(id: string): Promise<{ id: string }> {
  const doc = await Article.findByPk(id);
  if (!doc) {
    throw new HttpError(404, 'Article not found');
  }
  await Article.destroy({ where: { id } });
  // 级联删除该文章下的所有评论与回复，避免孤儿数据
  await Comment.destroy({ where: { articleId: id } });
  return { id: doc.id };
}
