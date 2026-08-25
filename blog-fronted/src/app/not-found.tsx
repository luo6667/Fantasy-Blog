import type { Metadata } from 'next';

import NotFoundView from '@/views/not-found';

/** 404 页：metadata 由服务端渲染，替代原客户端 useSeo */
export const metadata: Metadata = {
  title: '页面不存在 · JasonLuo',
};

export default NotFoundView;
