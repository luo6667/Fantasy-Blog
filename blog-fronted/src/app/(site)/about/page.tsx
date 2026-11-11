import type { Metadata } from 'next';

import About from '@/views/about';

/** 关于页（RSC）：静态内容，metadata 替代原 useSeo */
export const metadata: Metadata = {
  title: '关于我 · Fantasy',
  description: '前端工程师 Fantasy 的技术栈、经历与工具',
};

export default About;
