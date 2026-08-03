import type { BlogPost } from '@/types';

export const BLOG_POSTS: BlogPost[] = [
  {
    date: '2025-03-15',
    title: 'React 18 并发模式实战指南',
    excerpt:
      '深入探讨 React 18 的并发特性，包含 Suspense、useTransition、useDeferredValue 的实际应用场景与性能对比。',
    tags: ['React', '性能优化'],
  },
  {
    date: '2025-02-20',
    title: '前端工程化：从 ESLint 到 CI/CD',
    excerpt:
      '搭建一套完整的前端工程化体系，涵盖代码规范、自动化测试、持续集成与部署的最佳实践。',
    tags: ['工程化', 'CI/CD'],
  },
  {
    date: '2025-01-08',
    title: 'TypeScript 高级类型体操',
    excerpt:
      '掌握条件类型、模板字面量类型、映射类型等高级技巧，提升代码的类型安全性与可维护性。',
    tags: ['TypeScript'],
  },
  {
    date: '2024-11-25',
    title: 'Next.js App Router 深度解析',
    excerpt:
      '从 Pages Router 迁移到 App Router 的完整指南，包括服务端组件、流式渲染与增量静态再生。',
    tags: ['Next.js', 'SSR'],
  },
  {
    date: '2024-10-12',
    title: '构建高性能组件库的思考',
    excerpt:
      '如何设计可组合、可访问的组件 API？分享在真实项目中构建设计系统的经验与踩坑记录。',
    tags: ['设计系统'],
  },
  {
    date: '2024-09-01',
    title: '前端性能优化全景图',
    excerpt: '从网络层、渲染层到运行时，全面梳理前端性能优化的策略、工具与度量体系。',
    tags: ['性能优化'],
  },
];
