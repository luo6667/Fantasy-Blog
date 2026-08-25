import type { Metadata } from 'next';

import BlogView from '@/views/blog';

/** 博客列表页（RSC）：metadata 由服务端渲染，替代原客户端 useSeo */
export const metadata: Metadata = {
  title: '博客 · JasonLuo',
  description: 'JasonLuo 的技术博客 - 前端与全栈开发文章',
};

export default BlogView;
