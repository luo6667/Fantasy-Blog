import type { Education, ResumeProject } from '@/types';

export const RESUME_EDUCATION: Education[] = [
  {
    year: '2024.9 – 至今',
    title: '软件工程',
    school: '广东财经大学',
    desc: '前端工程化与 Web 性能优化',
  },
];

export const RESUME_SKILLS: string[] = [
  '前端开发：熟练掌握 React、TypeScript、Next.js 等主流框架，深入理解组件化架构与状态管理。了解 Vue.js 并有实际项目经验，具备良好的跨端开发能力。',
  '工程化实践：熟练使用 Git 进行版本管理与协作，掌握 Docker 容器化部署与 CI/CD 自动化流程。了解 AWS 云服务基础运维。',
  '软技能：具备良好的技术写作与文档能力，善于团队协作与知识分享，有敏捷开发与代码评审的实践经验。',
];

export const RESUME_PROJECTS: ResumeProject[] = [
  {
    title: '电商平台重构',
    meta: '2023 – 2024 · React · TypeScript · Next.js · GraphQL',
    desc: [
      '负责从技术选型到架构设计，将旧 jQuery 项目整体迁移至 React + TypeScript 生态。通过组件化拆分和状态管理重构，代码量减少 40%，可维护性大幅提升。',
      '引入 Next.js 服务端渲染方案，结合 CDN 缓存策略，首屏加载时间缩短 62%，Lighthouse 性能评分从 34 提升至 92，用户跳出率下降 28%。',
      '搭建基于 Storybook 的组件库与设计系统，覆盖 200+ 业务组件，产出完整开发文档。团队新成员上手时间从 2 周缩短至 3 天。',
    ],
  },
  {
    title: '实时协作白板',
    meta: 'Vue.js · WebSocket · Canvas API',
    desc: [
      '基于 Canvas API 与 WebSocket 构建实时协作绘图引擎，支持画笔、图形、文字标注等功能。通过操作合并与增量同步策略，实现毫秒级多端同步。',
      '设计离线队列与自动重连机制，网络波动时本地操作不丢失，恢复后自动同步冲突合并，保障协作体验的连续性。',
    ],
  },
];
