import type { Education, SkillGroup } from '@/types';

/**
 * 关于页的叙事内容。它不需要后台维护：修改这里并发布即可更新站点。
 */
export const ABOUT_PROFILE = {
  eyebrow: 'Creator dossier / 2026',
  name: 'Fantasy',
  role: '设计、开发与持续写作',
  intro: '我把想法落成可用的产品，也把过程整理成值得回看的文字。这个站点是作品集、实验场和长期笔记的交汇处。',
  focus: [
    { title: '正在构建', content: '更轻、更快，也更适合长期书写的个人内容系统。' },
    { title: '持续练习', content: '在前端工程、Go 服务与产品表达之间建立自己的工作方法。' },
  ],
  pointOfView: '好的个人作品不必喧哗。它应该有清晰的结构、可靠的细节，并留下一点让人愿意停留的温度。',
} as const;

export const ABOUT_CORE_SKILLS: SkillGroup[] = [
  {
    label: '前端',
    tags: ['Vue', 'React', 'Nextjs', 'Nuxtjs'],
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
  { label: '部署运维', tags: ['Docker', 'CI/CD', 'GitHub Actions'] },
  { label: '开发工具', tags: ['VS Code', 'Cursor', 'Postman', 'ApiFox', 'WebStorm', 'Chrome DevTools'] },
  { label: 'AI 开发', tags: ['Claude Code', 'Codex', 'Reasonix', 'Deepseekv4','Trae'] },
];

export const ABOUT_EDUCATION: Education[] = [
  {
    year: '2024.9 – 至今',
    title: '软件工程',
    school: '广东财经大学',
    desc: '主修课程：数据结构、计算机组成原理、操作系统、计算机网络、Web开发技术。',
  },
];
