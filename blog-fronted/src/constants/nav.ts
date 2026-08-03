import type { NavTab } from '@/types';

/**
 * 导航常量
 *
 * Nav 与 Footer 组件共享的标签页配置。
 * 修改导航项只需改这一处。
 */
export const NAV_TABS: NavTab[] = [
  { to: '/home', label: '首页' },
  { to: '/blog', label: '博客' },
  { to: '/resume', label: '简历' },
  { to: '/about', label: '关于' },
];
