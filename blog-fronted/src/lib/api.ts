/**
 * API 客户端
 *
 * 统一封装 fetch：
 * - 拼接 /api 前缀（开发环境由 Vite proxy 转发到后端）
 * - 自动附带 JWT（localStorage）
 * - 解包统一结构 { code, msg, data }，错误归一化为 ApiError
 * - 页面组件只负责调用与渲染，不感知网络细节
 */

import type {
  ArticleDetail,
  ArticleInput,
  ArticleListItem,
  AuthUser,
  CommentItem,
  LoginResult,
  PaginatedResult,
  TagCount,
  TagItem,
  UploadResult,
  UserRole,
} from '@/types/api';

const API_BASE = '/api';
const TOKEN_KEY = 'blog_token';

/** 业务/网络错误 */
export class ApiError extends Error {
  readonly code: number;
  readonly status: number;

  constructor(message: string, code: number, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** JWT token 存取 */
export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },
};

interface RequestOptions extends RequestInit {
  /** true 时不设置 Content-Type（用于 FormData 上传，由浏览器自动带 boundary） */
  raw?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!options.raw && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = tokenStore.get();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('网络错误，请确认后端服务已启动', -1, 0);
  }

  const body = (await res.json().catch(() => null)) as {
    code?: number;
    msg?: string;
    data?: T;
  } | null;

  if (!body || typeof body.code !== 'number') {
    throw new ApiError(`响应格式错误（HTTP ${String(res.status)}）`, -2, res.status);
  }
  if (body.code !== 0 || !res.ok) {
    throw new ApiError(body.msg ?? '请求失败', body.code, res.status);
  }
  return body.data as T;
}

/** 文章 API */
export const articleApi = {
  /** 分页列表，支持标签筛选 */
  list: (params?: { page?: number; pageSize?: number; tag?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.tag) qs.set('tag', params.tag);
    const q = qs.toString();
    return request<PaginatedResult<ArticleListItem>>(`/articles${q ? `?${q}` : ''}`);
  },

  detail: (id: string) => request<ArticleDetail>(`/articles/${id}`),

  /** 全部标签及文章数（用于筛选栏） */
  tags: () => request<TagCount[]>('/articles/tags'),

  create: (input: ArticleInput) =>
    request<ArticleDetail>('/articles', { method: 'POST', body: JSON.stringify(input) }),

  update: (id: string, input: Partial<ArticleInput>) =>
    request<ArticleDetail>(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  remove: (id: string) => request<{ id: string }>(`/articles/${id}`, { method: 'DELETE' }),
};

/** 认证 API */
export const authApi = {
  /** role: user 普通用户 / admin 管理员 */
  login: (role: UserRole, username: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    }),
  /** 注册普通用户 */
  register: (username: string, password: string) =>
    request<AuthUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<AuthUser>('/auth/me'),
};

/** 评论 API（列表公开；发表/回复/点赞/删除需登录） */
export const commentApi = {
  list: (articleId: string) => request<CommentItem[]>(`/articles/${articleId}/comments`),
  create: (articleId: string, content: string) =>
    request<CommentItem>(`/articles/${articleId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  reply: (commentId: string, content: string) =>
    request<CommentItem>(`/comments/${commentId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  like: (commentId: string) =>
    request<{ liked: boolean; likes: number }>(`/comments/${commentId}/like`, { method: 'POST' }),
  remove: (commentId: string) =>
    request<{ id: string }>(`/comments/${commentId}`, { method: 'DELETE' }),
};

/** 标签库 API（公开读，登录写） */
export const tagApi = {
  /** 标签库列表（含文章数） */
  list: () => request<TagItem[]>('/tags'),
  create: (name: string) =>
    request<TagItem>('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  remove: (name: string) =>
    request<{ name: string }>(`/tags/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

/** 上传 API */
export const uploadApi = {
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return request<UploadResult>('/upload', { method: 'POST', body: form, raw: true });
  },
};
