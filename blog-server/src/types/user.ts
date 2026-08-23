/** 用户管理项（管理员后台列表） */
export interface UserManageItem {
  id: string;
  username: string;
  createdAt: string;
  /** 评论数（含回复） */
  commentCount: number;
}
