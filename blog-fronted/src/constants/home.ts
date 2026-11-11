import type { HomeProjectItem } from '@/types/api';

/**
 * 首页精选项目默认值（后台 site_contents.homeProjects 未加载 / 加载失败时兜底）
 *
 * 线上以后台编辑结果为准；旧数据只有 name/desc/tags 时，首页读取会回退到 desc。
 */
export const HOME_PROJECTS: HomeProjectItem[] = [
  {
    name: 'Fantasy 博客',
    summary: '用 Next.js 与 Go 重写的个人站点：编辑式首页、主标签体系与可维护的内容后台。',
    category: '内容系统',
    year: '2026',
    cover: '',
    coverAlt: 'Fantasy 博客的编辑排版封面',
    tags: ['Next.js', 'Go', 'Gin', 'MySQL'],
    link: 'https://github.com/luo6667',
    linkLabel: '查看 GitHub',
    featured: true,
    order: 1,
  },
  {
    name: '电商平台重构',
    summary: '把大型 B2C 电商前端从 jQuery 迁移到 React + TypeScript，重构组件层与数据流。',
    category: '产品实验',
    year: '2025',
    cover: '',
    coverAlt: '电商平台重构项目封面',
    tags: ['React', 'TypeScript', 'Next.js', 'GraphQL'],
    featured: true,
    order: 2,
  },
  {
    name: '实时协作白板',
    summary: '基于 WebSocket 与 Canvas 的多人协作白板，支持画笔、图形与文字标注。',
    category: '设计探索',
    year: '2025',
    cover: '',
    coverAlt: '实时协作白板项目封面',
    tags: ['Vue.js', 'WebSocket', 'Canvas API'],
    featured: true,
    order: 3,
  },
  {
    name: '数据可视化仪表盘',
    summary: '面向百万级数据点的可视化仪表盘，用虚拟滚动与增量渲染保持交互流畅。',
    category: '数据可视化',
    year: '2024',
    cover: '',
    coverAlt: '数据可视化仪表盘项目封面',
    tags: ['D3.js', 'React', 'Node.js', 'WebGL'],
    featured: true,
    order: 4,
  },
];
