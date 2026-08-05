/** 用户搜索项（发起聊天时选择对方） */
export interface UserBrief {
  id: string;
  username: string;
  role: 'user' | 'admin';
}
