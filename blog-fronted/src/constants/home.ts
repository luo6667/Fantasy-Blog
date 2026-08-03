import type { HomeProject } from '@/types';

export const HOME_PROJECTS: HomeProject[] = [
  {
    name: '电商平台重构',
    desc: '主导大型 B2C 电商平台前端架构重构，从传统 jQuery 迁移至 React + TypeScript 技术栈。',
    tags: ['React', 'TypeScript', 'Next.js', 'GraphQL'],
  },
  {
    name: '实时协作白板',
    desc: '基于 WebSocket 与 Canvas 的多人在线协作工具，支持画笔、图形、文字等丰富标注功能。',
    tags: ['Vue.js', 'WebSocket', 'Canvas API'],
  },
  {
    name: '数据可视化仪表盘',
    desc: '企业级数据分析平台，实时渲染百万级数据点，采用虚拟滚动与增量渲染优化交互体验。',
    tags: ['D3.js', 'React', 'Node.js', 'WebGL'],
  },
];
