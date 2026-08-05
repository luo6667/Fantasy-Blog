/** 通知类型：评论文章 / 回复评论 / 点赞文章 / 收藏文章 / 新文章发布 */
export type NotificationType = 'comment' | 'reply' | 'like' | 'favorite' | 'article';

/** 通知项（对外返回） */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  /** 触发者 */
  actorName: string;
  actorType: 'user' | 'admin';
  /** 关联文章 */
  articleId?: string;
  articleTitle?: string;
  /** 评论/回复内容（comment/reply 类型） */
  commentContent?: string;
  read: boolean;
  createdAt: string;
}
