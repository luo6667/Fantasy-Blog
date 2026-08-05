/** 聊天的对方（普通用户或管理员） */
export interface ChatPeer {
  id: string;
  username: string;
  role: 'user' | 'admin';
}

/** 会话项（对外返回） */
export interface ConversationItem {
  id: string;
  /** 对方信息 */
  peer: ChatPeer;
  lastMessage?: string;
  lastMessageAt: string;
  /** 当前用户未读消息数 */
  unread: number;
  /** 对方是否在线（Socket.IO 连接中） */
  isOnline: boolean;
}

/** 消息项（对外返回） */
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
