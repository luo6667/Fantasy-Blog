/**
 * 📘 lib/api.ts —— 数据层统一出口（技术栈：axios + 拦截器 + 统一解包）
 *
 * 全站唯一的 HTTP 封装，页面/组件只调用这里的函数，不感知网络细节：
 * - 请求拦截器自动附带 JWT（localStorage 的 token）；
 * - 响应拦截器把网络错误 / 非 2xx / 业务错误统一归一化为 ApiError；
 * - request<T>() 解包后端统一结构 { code, msg, data }，code !== 0 抛 ApiError；
 * - 浏览器端走同源 /api（next.config rewrites 代理到后端）；服务端（SSR 运行时 /
 *   SSG 构建期 generateStaticParams、generateMetadata、server component 取数）直连 API_TARGET。
 */
import axios, { AxiosError } from 'axios';

import type {
  ArticleDetail,
  ArticleInput,
  ArticleListItem,
  AuthUser,
  LoginResult,
  PaginatedResult,
  SiteContentItem,
  SiteContentKey,
  SiteContentValue,
  TagItem,
  UploadResult,
} from '@/types/api';

/**
 * API 基地址：
 * - 浏览器：同源 /api（Next rewrites 代理到 Go 后端）
 * - 服务端（SSR 预取等）：直连后端，绝对地址
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
  /** 分页列表，支持主标签筛选与关键字搜索 */
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

  create: (input: ArticleInput) =>
    request<ArticleDetail>('/articles', { method: 'POST', body: JSON.stringify(input) }),

  update: (id: string, input: Partial<ArticleInput>) =>
    request<ArticleDetail>(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  remove: (id: string) => request<{ id: string }>(`/articles/${id}`, { method: 'DELETE' }),
};

/** 认证 API（仅管理员） */
export const authApi = {
  login: (username: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<AuthUser>('/auth/me'),
};

/** 主标签库 API（公开读，管理员写） */
export const tagApi = {
  /** 主标签列表（含文章数） */
  list: () => request<TagItem[]>('/tags'),
  create: (name: string) =>
    request<TagItem>('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  rename: (id: string, name: string) =>
    request<TagItem>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  remove: (id: string) => request<{ id: string }>(`/tags/${id}`, { method: 'DELETE' }),
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
