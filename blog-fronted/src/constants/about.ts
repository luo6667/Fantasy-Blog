import type { Education, SkillGroup } from '@/types';

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
