import { HttpError } from '../middleware/error.js';
import { Article } from '../models/Article.js';
import { Comment, type CommentDoc } from '../models/Comment.js';
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
  doc: CommentDoc,
  likedByMe: boolean,
  mine: boolean,
  replyToName: string | null,
): CommentItem {
  return {
    id: doc._id.toString(),
    articleId: doc.article.toString(),
    parentId: doc.parent ? doc.parent.toString() : null,
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
  if (!(await Article.exists({ _id: articleId }))) {
    throw new HttpError(404, '文章不存在');
  }
  const docs = await Comment.find({ article: articleId }).sort({ createdAt: 1 }).lean();
  const meKey = currentUser ? likeKey(currentUser) : '';
  // 构建 id → 作者名 映射，用于「谁回复谁」
  const nameMap = new Map(docs.map((d) => [d._id.toString(), d.authorName]));
  return docs.map((d) =>
    toItem(
      d,
      meKey !== '' && d.likedBy.includes(meKey),
      currentUser !== undefined && d.authorType === currentUser.role && d.authorId.toString() === currentUser.id,
      d.parent ? (nameMap.get(d.parent.toString()) ?? null) : null,
    ),
  );
}

/** 发表一级评论（通知文章作者） */
export async function createComment(
  articleId: string,
  user: AuthUser,
  content: string,
): Promise<CommentItem> {
  const article = await Article.findById(articleId);
  if (!article) {
    throw new HttpError(404, '文章不存在');
  }
  const doc = await Comment.create({
    article: articleId,
    parent: null,
    authorType: user.role,
    authorId: user.id,
    authorName: user.username,
    content,
  });
  // 通知文章作者（作者非评论者本人；无作者时回退管理员）
  if (!(article.authorType === user.role && article.authorId?.toString() === user.id)) {
    const recipient = await resolveArticleRecipient(article);
    if (recipient) {
      await createNotification({
        recipient,
        actor: user,
        type: 'comment',
        articleId: article._id.toString(),
        articleTitle: article.title,
        commentId: doc._id.toString(),
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
  const parent = await Comment.findById(commentId);
  if (!parent) {
    throw new HttpError(404, '评论不存在');
  }
  const doc = await Comment.create({
    article: parent.article,
    parent: parent._id,
    authorType: user.role,
    authorId: user.id,
    authorName: user.username,
    content,
  });
  // 通知被回复者（非本人时）
  if (!(parent.authorType === user.role && parent.authorId.toString() === user.id)) {
    const article = await Article.findById(parent.article);
    await createNotification({
      recipient: { role: parent.authorType, id: parent.authorId.toString() },
      actor: user,
      type: 'reply',
      articleId: parent.article.toString(),
      articleTitle: article?.title,
      commentId: doc._id.toString(),
      commentContent: content,
    });
  }
  return toItem(doc, false, true, parent.authorName);
}

/** 点赞 / 取消点赞（原子操作，并发安全），返回最新状态 */
export async function toggleLike(
  commentId: string,
  user: AuthUser,
): Promise<{ liked: boolean; likes: number }> {
  const key = likeKey(user);
  // 尝试点赞：仅当 likedBy 不含 key 时 $addToSet
  const liked = await Comment.findOneAndUpdate(
    { _id: commentId, likedBy: { $ne: key } },
    { $addToSet: { likedBy: key } },
    { new: true },
  );
  if (liked) {
    return { liked: true, likes: liked.likedBy.length };
  }
  // 已点过 → 取消（仅当 likedBy 含 key 时 $pull）
  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, likedBy: key },
    { $pull: { likedBy: key } },
    { new: true },
  );
  if (!comment) {
    throw new HttpError(404, '评论不存在');
  }
  return { liked: false, likes: comment.likedBy.length };
}

/** 删除评论及其全部子孙回复（作者本人或管理员） */
export async function deleteComment(commentId: string, user: AuthUser): Promise<{ id: string }> {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new HttpError(404, '评论不存在');
  }
  const isAuthor = comment.authorType === user.role && comment.authorId.toString() === user.id;
  if (!isAuthor && user.role !== 'admin') {
    throw new HttpError(403, '无权删除该评论');
  }

  // 收集评论本身及其所有子孙回复（BFS 沿 parent 链向下）
  const ids = [comment._id];
  let frontier = [comment._id];
  while (frontier.length > 0) {
    const children = await Comment.find({ parent: { $in: frontier } }).select('_id').lean();
    const childIds = children.map((c) => c._id);
    if (childIds.length === 0) break;
    ids.push(...childIds);
    frontier = childIds;
  }
  await Comment.deleteMany({ _id: { $in: ids } });
  return { id: commentId };
}
