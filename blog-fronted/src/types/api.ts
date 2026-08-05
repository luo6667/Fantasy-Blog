/**
 * 后端 API 数据类型（与 blog-server 的响应结构对齐）
 */

/** 后端统一返回结构：{ code, msg, data } */
export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

/** 文章列表项（不含正文） */
export interface ArticleListItem {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  cover?: string;
  /** 发布日期 YYYY-MM-DD */
  date: string;
  createdAt: string;
  updatedAt: string;
  /** 点赞数 */
  likes: number;
  /** 收藏数 */
  favorites: number;
  /** 当前登录用户是否已点赞（未登录恒为 false） */
  likedByMe: boolean;
  /** 当前登录用户是否已收藏（未登录恒为 false） */
  favoritedByMe: boolean;
}

/** 文章详情（含正文） */
export interface ArticleDetail extends ArticleListItem {
  content: string;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 标签及文章数（博客页筛选栏用） */
export interface TagCount {
  name: string;
  count: number;
}

/** 标签库标签项 */
export interface TagItem {
  id: string;
  name: string;
  /** 使用该标签的文章数 */
  count: number;
}

/** 身份角色 */
export type UserRole = 'user' | 'admin';

/** 登录用户信息 */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

/** 登录响应 */
export interface LoginResult {
  token: string;
  user: AuthUser;
}

/** 评论项（含点赞状态） */
export interface CommentItem {
  id: string;
  articleId: string;
  /** 父评论 id；一级评论为 null */
  parentId: string | null;
  authorName: string;
  authorType: UserRole;
  /** 被回复者名字（一级评论为 null），用于「谁回复谁」展示 */
  replyToName: string | null;
  content: string;
  likes: number;
  /** 当前登录用户是否已点赞 */
  likedByMe: boolean;
  /** 当前登录用户是否为作者本人 */
  mine: boolean;
  createdAt: string;
}

/** 创建/更新文章请求体 */
export interface ArticleInput {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  cover?: string;
}

/** 上传响应 */
export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

/** 通知类型：评论文章 / 回复评论 / 点赞文章 / 收藏文章 / 新文章发布 */
export type NotificationType = 'comment' | 'reply' | 'like' | 'favorite' | 'article';

/** 通知项 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  /** 触发者 */
  actorName: string;
  actorType: UserRole;
  /** 关联文章 */
  articleId?: string;
  articleTitle?: string;
  /** 评论/回复内容（comment/reply 类型） */
  commentContent?: string;
  read: boolean;
  createdAt: string;
}

/** 聊天对方 */
export interface ChatPeer {
  id: string;
  username: string;
  role: UserRole;
}

/** 会话项 */
export interface ConversationItem {
  id: string;
  peer: ChatPeer;
  lastMessage?: string;
  lastMessageAt: string;
  /** 当前用户未读消息数 */
  unread: number;
  /** 对方是否在线 */
  isOnline: boolean;
}

/** 消息项 */
export interface MessageItem {
  id: string;
  conversationId: string;
  sender: ChatPeer;
  content: string;
  /** 是否为当前用户自己发送 */
  mine: boolean;
  read: boolean;
  createdAt: string;
}

/** 用户搜索项（发起聊天时选择对方） */
export interface UserBrief {
  id: string;
  username: string;
  role: UserRole;
}
