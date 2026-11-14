import type { Education, SkillGroup } from '@/types';

/**
 * 关于页的叙事内容。它不需要后台维护：修改这里并发布即可更新站点。
 */
export const ABOUT_PROFILE = {
  eyebrow: 'Creator dossier / 2026',
  name: 'Fantasy',
  role: 'LEARN · CREATE · SHARE · GAIN · GROW',
  intro: '专注全栈开发与技术沉淀，把学习和实践过程整理成可复用的经验 这里是我的项目作品集、技术笔记与成长记录',
  focus: [
    { title: 'Golang与数据库', content: '学习Gin，Gorm，深耕MySQL、Redis数据库，沉淀稳定的服务端开发实践' },
    { title: 'AI Agent探索', content: '探索AI Agent与大模型应用落地，打磨AI辅助开发工作流，坚持自主校验与逻辑把控' },
  ],
  pointOfView: 'There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self',
} as const;

export const ABOUT_CORE_SKILLS: SkillGroup[] = [
  {
    label: '前端',
    tags: ['JavaScript', 'TypeScript', 'Vue', 'React', 'Nextjs', 'Nuxtjs', 'Uniapp'],
  },
  {
    label: '后端',
    tags: ['Golang', 'Gin', 'Gorm', 'Node.js', 'Express'],
  },
  {
    label: '数据库',
    tags: ['MySQL', 'Redis', 'MongoDB'],
  },
  {
    label: '网络与协议',
    tags: ['HTTP 协议', 'WebSocket', 'SSE'],
  },
  {
    label: '工程化',
    tags: ['Vite', 'Webpack', 'CI CD', 'Docker'],
  },
];

export const ABOUT_TOOL_GROUPS: SkillGroup[] = [
  { label: '版本控制', tags: ['Git'] },
  { label: '部署运维', tags: ['Docker', 'CI/CD'] },
  { label: '开发工具', tags: ['Cursor', 'Goland', 'Trae', 'ApiFox'] },
  { label: 'AI 开发', tags: ['Claude Code', 'Codex', 'DeepSeek Harness'] },
];

export const ABOUT_EDUCATION: Education[] = [
  {
    year: '2024.9 – 至今',
    title: '软件工程',
    school: '广东财经大学',
    desc: '主修课程：数据结构、计算机组成原理、操作系统、计算机网络、Web开发技术。',
  },
];
