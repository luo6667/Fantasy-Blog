/**
 * 评论相关类型
 */

/** 作者类型 */
export type CommentAuthorType = 'user' | 'admin';

/** 评论项（列表返回，含点赞状态） */
export interface CommentItem {
  id: string;
  articleId: string;
  /** 父评论 id；一级评论为 null */
  parentId: string | null;
  authorName: string;
  authorType: CommentAuthorType;
  /** 被回复者名字（一级评论为 null），用于「谁回复谁」展示 */
  replyToName: string | null;
  content: string;
  likes: number;
  /** 当前登录用户是否已点赞（未登录恒为 false） */
  likedByMe: boolean;
  /** 当前登录用户是否为作者本人（未登录恒为 false） */
  mine: boolean;
  createdAt: string;
}
