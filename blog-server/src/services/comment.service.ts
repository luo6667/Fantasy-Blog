import { Op } from 'sequelize';

import { sequelize } from '../db/sequelize.js';
import { HttpError } from '../middleware/error.js';
import Article from '../models/Article.js';
import Comment from '../models/Comment.js';
import { createNotification, resolveArticleRecipient } from './notification.service.js';
import type { AuthUser } from '../types/auth.js';
import type { CommentItem } from '../types/comment.js';

/**
 * 评论业务逻辑
 *
 * listComments：按文章拉取全部评论（含所有层级回复，时间升序），公开可读
 * createComment：发表一级评论（登录）
 * createReply：回复任意评论（登录，支持无限嵌套，前端扁平渲染）
 * toggleLike：点赞 / 取消点赞（登录）
 * deleteComment：删除评论及其全部子孙回复（作者本人或管理员）
 */

function likeKey(user: AuthUser): string {
  return `${user.role}:${user.id}`;
}

function toItem(
  doc: Comment,
  likedByMe: boolean,
  mine: boolean,
  replyToName: string | null,
): CommentItem {
  return {
    id: doc.id,
    articleId: doc.articleId,
    parentId: doc.parentId,
    authorName: doc.authorName,
    authorType: doc.authorType,
    content: doc.content,
    likes: doc.likedBy.length,
    likedByMe,
    mine,
    replyToName,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** 文章评论列表（含回复；currentUser 用于返回点赞状态） */
export async function listComments(
  articleId: string,
  currentUser?: AuthUser,
): Promise<CommentItem[]> {
  const articleCount = await Article.count({ where: { id: articleId } });
  if (articleCount === 0) {
    throw new HttpError(404, '文章不存在');
  }
  const docs = await Comment.findAll({ where: { articleId }, order: [['createdAt', 'ASC']] });
  const meKey = currentUser ? likeKey(currentUser) : '';
  // 构建 id → 作者名 映射，用于「谁回复谁」
  const nameMap = new Map(docs.map((d) => [d.id, d.authorName]));
  return docs.map((d) =>
    toItem(
      d,
      meKey !== '' && d.likedBy.includes(meKey),
      currentUser !== undefined && d.authorType === currentUser.role && d.authorId === currentUser.id,
      d.parentId ? (nameMap.get(d.parentId) ?? null) : null,
    ),
  );
}

/** 发表一级评论（通知文章作者） */
export async function createComment(
  articleId: string,
  user: AuthUser,
  content: string,
): Promise<CommentItem> {
  const article = await Article.findByPk(articleId);
  if (!article) {
    throw new HttpError(404, '文章不存在');
  }
  const doc = await Comment.create({
    articleId,
    parentId: null,
    authorType: user.role,
    authorId: user.id,
    authorName: user.username,
    content,
    likedBy: [],
  });
  // 通知文章作者（作者非评论者本人；无作者时回退管理员）
  if (!(article.authorType === user.role && article.authorId === user.id)) {
    const recipient = await resolveArticleRecipient(article);
    if (recipient) {
      await createNotification({
        recipient,
        actor: user,
        type: 'comment',
        articleId: article.id,
        articleTitle: article.title,
        commentId: doc.id,
        commentContent: content,
      });
    }
  }
  return toItem(doc, false, true, null);
}

/** 回复任意评论（无限嵌套；被回复者信息由前端结合 replyToName 展示），通知被回复者 */
export async function createReply(
  commentId: string,
  user: AuthUser,
  content: string,
): Promise<CommentItem> {
  const parent = await Comment.findByPk(commentId);
  if (!parent) {
    throw new HttpError(404, '评论不存在');
  }
  const doc = await Comment.create({
    articleId: parent.articleId,
    parentId: parent.id,
    authorType: user.role,
    authorId: user.id,
    authorName: user.username,
    content,
    likedBy: [],
  });
  // 通知被回复者（非本人时）
  if (!(parent.authorType === user.role && parent.authorId === user.id)) {
    const article = await Article.findByPk(parent.articleId);
    await createNotification({
      recipient: { role: parent.authorType, id: parent.authorId },
      actor: user,
      type: 'reply',
      articleId: parent.articleId,
      articleTitle: article?.title,
      commentId: doc.id,
      commentContent: content,
    });
  }
  return toItem(doc, false, true, parent.authorName);
}

/**
 * 点赞 / 取消点赞（原子操作，并发安全），返回最新状态
 *
 * 用事务 + 行锁（SELECT ... FOR UPDATE）实现「点过则取消、没点过则点赞」，
 * 语义与旧 MongoDB 的条件更新（$addToSet / $pull）一致。
 */
export async function toggleLike(
  commentId: string,
  user: AuthUser,
): Promise<{ liked: boolean; likes: number }> {
  return sequelize.transaction(async (t) => {
    const comment = await Comment.findByPk(commentId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!comment) {
      throw new HttpError(404, '评论不存在');
    }
    const key = likeKey(user);
    if (comment.likedBy.includes(key)) {
      comment.likedBy = comment.likedBy.filter((k) => k !== key);
    } else {
      // 重新赋值触发 Sequelize 变更检测（原地 push 不会标记字段为已修改）
      comment.likedBy = [...comment.likedBy, key];
    }
    await comment.save({ transaction: t });
    return { liked: comment.likedBy.includes(key), likes: comment.likedBy.length };
  });
}

/** 删除评论及其全部子孙回复（作者本人或管理员） */
export async function deleteComment(commentId: string, user: AuthUser): Promise<{ id: string }> {
  const comment = await Comment.findByPk(commentId);
  if (!comment) {
    throw new HttpError(404, '评论不存在');
  }
  const isAuthor = comment.authorType === user.role && comment.authorId === user.id;
  if (!isAuthor && user.role !== 'admin') {
    throw new HttpError(403, '无权删除该评论');
  }

  // 收集评论本身及其所有子孙回复（BFS 沿 parent 链向下）
  const ids = [comment.id];
  let frontier = [comment.id];
  while (frontier.length > 0) {
    const children = await Comment.findAll({
      where: { parentId: { [Op.in]: frontier } },
      attributes: ['id'],
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) break;
    ids.push(...childIds);
    frontier = childIds;
  }
  await Comment.destroy({ where: { id: { [Op.in]: ids } } });
  return { id: commentId };
}
