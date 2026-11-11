import type { PlanItemStatus, PlanStage } from '@/types/api';

/**
 * 规划页默认内容
 *
 * 与后端 siteContentDefaults 的 plan 默认值保持一致；
 * 仅在接口未返回 / 请求失败时兜底展示，正常渲染以管理后台内容为准。
 */
export const PLAN_STAGES: PlanStage[] = [
  {
    period: '2024.9 – 2025.6',
    title: '打基础：HTML / CSS / JavaScript',
    summary: '把三件套、浏览器基础与 Git 工作流练熟，能独立完成响应式静态页面。',
    status: 'done',
    goals: [
      {
        title: 'HTML / CSS 布局与响应式',
        desc: '掌握 Flex / Grid、移动端适配与常见页面布局方案。',
        status: 'done',
        tags: ['HTML', 'CSS'],
      },
      {
        title: 'JavaScript 核心与 ES6+',
        desc: '闭包、原型链、异步与模块化，能手写常见工具函数。',
        status: 'done',
        tags: ['JavaScript'],
      },
      {
        title: 'Git 与命令行工作流',
        desc: '分支管理、提交规范与代码评审流程。',
        status: 'done',
        tags: ['Git'],
      },
    ],
  },
  {
    period: '2025.7 – 2026.6',
    title: '进阶：React 生态与全栈项目',
    summary: '以 React + TypeScript 为主线，完成一个可上线的全栈项目并沉淀工程规范。',
    status: 'active',
    goals: [
      {
        title: 'React 组件化与状态管理',
        desc: '组件拆分、Hooks、zustand 与 React Query 的数据流设计。',
        status: 'done',
        tags: ['React', 'TypeScript'],
      },
      {
        title: 'Next.js App Router 与 SSR / ISR',
        desc: '服务端组件、路由组织、静态化与按需 revalidate。',
        status: 'active',
        tags: ['Next.js'],
      },
      {
        title: 'Node + MySQL 全栈闭环',
        desc: 'Express 分层、Sequelize 建模、鉴权与部署。',
        status: 'active',
        tags: ['Node.js', 'MySQL'],
      },
      {
        title: '工程规范与 CI/CD',
        desc: 'ESLint / Prettier / 类型检查 + 自动化部署流水线。',
        status: 'planned',
        tags: ['CI/CD'],
      },
    ],
  },
  {
    period: '2026.7 – 2027.6',
    title: '深入：原理、性能与可视化',
    summary: '从会用走向理解，补齐浏览器原理、性能优化与数据可视化能力。',
    status: 'planned',
    goals: [
      {
        title: '浏览器渲染与性能优化',
        desc: '重排重绘、首屏指标、打包体积与缓存策略。',
        status: 'planned',
        tags: ['Performance'],
      },
      {
        title: '数据可视化实战',
        desc: 'ECharts / D3 图表封装与大数据量渲染优化。',
        status: 'planned',
        tags: ['可视化'],
      },
      {
        title: '源码阅读：React 与构建工具',
        desc: '跟着调度器与打包流程读源码，并整理成笔记。',
        status: 'planned',
        tags: ['源码'],
      },
    ],
  },
  {
    period: '2027 以后',
    title: '长期：AI 应用与开源',
    summary: '把 AI 能力做成产品，参与开源，形成自己的技术表达。',
    status: 'planned',
    goals: [
      {
        title: 'AI 应用与 Agent 实践',
        desc: '提示工程、流式对话、RAG 与工具调用的落地经验。',
        status: 'planned',
        tags: ['AI'],
      },
      {
        title: '持续输出与开源贡献',
        desc: '保持博客更新，给用到的开源项目提 PR。',
        status: 'planned',
        tags: ['开源'],
      },
    ],
  },
];

/** 规划状态 → 中文文案（页面徽章与后台编辑器共用） */
export const PLAN_STATUS_LABEL: Record<PlanItemStatus, string> = {
  planned: '未开始',
  active: '进行中',
  done: '已完成',
};

/** 后台状态下拉选项（顺序：未开始 → 进行中 → 已完成） */
export const PLAN_STATUS_OPTIONS: { value: PlanItemStatus; label: string }[] = [
  { value: 'planned', label: PLAN_STATUS_LABEL.planned },
  { value: 'active', label: PLAN_STATUS_LABEL.active },
  { value: 'done', label: PLAN_STATUS_LABEL.done },
];
