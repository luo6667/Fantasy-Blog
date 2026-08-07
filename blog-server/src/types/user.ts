/** 用户搜索项（发起聊天时选择对方） */
export interface UserBrief {
  id: string;
  username: string;
  role: 'user' | 'admin';
}

/** 用户管理项（管理员后台列表） */
export interface UserManageItem {
  id: string;
  username: string;
  createdAt: string;
  /** 评论数（含回复） */
  commentCount: number;
  /** 收藏文章数 */
  favoriteCount: number;
}
