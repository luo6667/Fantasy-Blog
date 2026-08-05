import { create } from 'zustand';

import type { ThemeMode } from '@/types';

/**
 * 主题 Store（zustand）
 *
 * 替代原 ThemeContext/ThemeProvider：
 * - 管理 light/dark 模式，持久化到 localStorage
 * - 主题变化时同步写入 <html data-theme>（驱动 Tailwind 暗色模式）
 */
interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
}

/** 初始化主题：优先读取 localStorage，否则默认 light */
function getInitialTheme(): ThemeMode {
  if (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') {
    return 'dark';
  }
  return 'light';
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' }));
  },
}));

// 模块加载即同步初始主题，避免首屏闪错主题
if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('data-theme', useThemeStore.getState().theme);
}

// 主题变化时同步到 DOM 与 localStorage
useThemeStore.subscribe((s, prev) => {
  if (s.theme === prev.theme) return;
  document.documentElement.setAttribute('data-theme', s.theme);
  localStorage.setItem('theme', s.theme);
});
