/**
 * 📘 lib/api.ts —— 数据层统一出口（技术栈：axios + 拦截器 + 统一解包）
 *
 * 全站唯一的 HTTP 封装，页面/组件只调用这里的函数，不感知网络细节：
 * - 请求拦截器自动附带 JWT（localStorage 的 token）；
 * - 响应拦截器把网络错误 / 非 2xx / 业务错误统一归一化为 ApiError；
 * - request<T>() 解包后端统一结构 { code, msg, data }，code !== 0 抛 ApiError；
 * - 浏览器端走同源 /api（next.config rewrites 代理到后端）；服务端（SSR 运行时 /
 *   SSG 构建期 generateStaticParams、generateMetadata、server component 取数）直连 API_TARGET；
 * - 注意：AI 流式对话(SSE)不用 axios（流式读取支持不成熟），
 *   用原生 fetch + ReadableStream（见下方 aiChatStream）。
 */
import axios, { AxiosError } from 'axios';

import type {
  AiChatMessage,
  AiSettings,
  ArticleDetail,
  ArticleInput,
  ArticleListItem,
  AuthUser,
  CommentItem,
  LoginResult,
  NotificationItem,
  PaginatedResult,
  SiteContentItem,
  SiteContentKey,
  SiteContentValue,
  TagCount,
  TagItem,
  UploadResult,
  UserManageItem,
  UserRole,
} from '@/types/api';

/**
 * API 基地址：
 * - 浏览器：同源 /api（Next rewrites 代理到 Express）
 * - 服务端（SSR 预取等）：直连 Express，绝对地址
 */
const API_BASE =
  typeof window !== 'undefined'
    ? '/api'
    : `${process.env.API_TARGET ?? 'http://localhost:4000'}/api`;
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

/** JWT token 存取（服务端渲染时无 localStorage，get 做环境守卫） */
export const tokenStore = {
  get: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  set: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },
};

interface RequestOptions {
  /** HTTP 方法（默认 GET） */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** 请求体（保持 fetch 风格命名；字符串/FormData 均可，axios 按 Content-Type 序列化） */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** true 时不设置 Content-Type（用于 FormData 上传，由浏览器自动带 boundary） */
  raw?: boolean;
}

/** axios 实例：baseURL /api + 30s 超时 */
const http = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
});

// 请求拦截器：自动附带 JWT
http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：HTTP 非 2xx / 网络错误 / 超时归一化为 ApiError
http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ code?: number; msg?: string }>) => {
    if (!err.response) {
      const msg = err.code === 'ECONNABORTED' ? '请求超时' : '网络错误，请确认后端服务已启动';
      return Promise.reject(new ApiError(msg, -1, 0));
    }
    const body = err.response.data;
    const code = typeof body.code === 'number' ? body.code : -2;
    return Promise.reject(
      new ApiError(body.msg ?? `请求失败（HTTP ${String(err.response.status)}）`, code, err.response.status),
    );
  },
);

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, signal, raw } = options;
  const reqHeaders: Record<string, string> = { ...(headers ?? {}) };
  if (!raw && body && !(body instanceof FormData)) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await http.request<T>({
      url: path,
      method,
      data: body,
      headers: reqHeaders,
      signal,
    });
  } catch (e) {
    // 拦截器已把网络错误/非 2xx 归一化为 ApiError，其余（如用户取消）也统一提示
    if (e instanceof ApiError) throw e;
    throw new ApiError('网络错误，请确认后端服务已启动', -1, 0);
  }

  // 2xx：解包统一结构 { code, msg, data }
  const payload = res.data as { code?: number; msg?: string; data?: T } | null;
  if (!payload || typeof payload.code !== 'number') {
    throw new ApiError(`响应格式错误（HTTP ${String(res.status)}）`, -2, res.status);
  }
  if (payload.code !== 0) {
    throw new ApiError(payload.msg ?? '请求失败', payload.code, res.status);
  }
  return payload.data as T;
}

/** 文章 API */
export const articleApi = {
  /** 分页列表，支持标签筛选与关键字搜索 */
  list: (params?: { page?: number; pageSize?: number; tag?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.tag) qs.set('tag', params.tag);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<PaginatedResult<ArticleListItem>>(`/articles${q ? `?${q}` : ''}`);
  },

  detail: (id: string) => request<ArticleDetail>(`/articles/${id}`),

  /** 全部标签及文章数（用于筛选栏） */
  tags: () => request<TagCount[]>('/articles/tags'),

  /** 点赞 / 取消点赞 */
  like: (id: string) => request<{ liked: boolean; likes: number }>(`/articles/${id}/like`, { method: 'POST' }),

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

/** 站点内容 API（公开读，管理员写） */
export const siteContentApi = {
  /** 全部内容（管理员后台用） */
  list: () => request<SiteContentItem[]>('/site-content'),
  /** 单个内容（页面渲染用） */
  get: (key: SiteContentKey) => request<SiteContentItem>(`/site-content/${key}`),
  /** 整体更新单个内容 */
  update: (key: SiteContentKey, value: SiteContentValue) =>
    request<SiteContentItem>(`/site-content/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
};

/** 上传 API */
export const uploadApi = {
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return request<UploadResult>('/upload', { method: 'POST', body: form, raw: true });
  },
};

/** 通知 API（登录） */
export const notificationApi = {
  list: () => request<NotificationItem[]>('/notifications'),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  /** ids 缺省时标记全部已读 */
  markRead: (ids?: string[]) =>
    request<{ ok: boolean }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {}),
    }),
};

/** 用户 API（登录） */
export const userApi = {
  /** 用户列表 + 统计（管理员） */
  listManage: () => request<UserManageItem[]>('/users/manage'),
  /** 删除用户及级联数据（管理员） */
  remove: (id: string) => request<{ id: string }>(`/users/${id}`, { method: 'DELETE' }),
};

/** AI API（配置管理 + 流式对话） */
export const aiApi = {
  /** 读取配置（管理员；apiKey 不回传明文，仅 hasKey） */
  getSettings: () => request<AiSettings>('/ai/settings'),
  /** 保存配置（apiKey 留空 = 保留旧值） */
  saveSettings: (input: { baseURL: string; apiKey?: string; model: string }) =>
    request<AiSettings>('/ai/settings', { method: 'PUT', body: JSON.stringify(input) }),
};

/**
 * AI 流式对话（SSE，OpenAI 兼容）
 *
 * 返回异步生成器，逐段产出文本增量（打字机效果）。
 * 未配置 AI / 上游错误 / 网络错误时抛出 ApiError。
 */
export async function* aiChatStream(
  messages: AiChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch {
    throw new ApiError('网络错误，请确认后端服务已启动', -1, 0);
  }

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { msg?: string; code?: number } | null;
    throw new ApiError(
      body?.msg ?? `AI 请求失败（HTTP ${String(res.status)}）`,
      body?.code ?? res.status,
      res.status,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* 忽略无法解析的 SSE 行 */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
