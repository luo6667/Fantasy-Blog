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

/** 亮/暗主题下的浏览器地址栏颜色（与 index.css 的 --color-bg 一致） */
const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#faf9f7',
  dark: '#1d1b19',
};

/** 同步 <meta name="theme-color">（移动端浏览器地址栏颜色随主题变化） */
function syncThemeColor(theme: ThemeMode): void {
  const el = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (el) el.setAttribute('content', THEME_COLORS[theme]);
}

// 模块加载即同步初始主题，避免首屏闪错主题
if (typeof window !== 'undefined') {
  const initialTheme = useThemeStore.getState().theme;
  document.documentElement.setAttribute('data-theme', initialTheme);
  syncThemeColor(initialTheme);
}

// 主题变化时同步到 DOM 与 localStorage
useThemeStore.subscribe((s, prev) => {
  if (s.theme === prev.theme) return;
  document.documentElement.setAttribute('data-theme', s.theme);
  localStorage.setItem('theme', s.theme);
  syncThemeColor(s.theme);
});
