import { useShallow } from 'zustand/react/shallow';

import { useThemeStore } from '@/stores/themeStore';
import type { ThemeContextValue } from '@/types';

/**
 * 主题 Hook
 *
 * 从 zustand themeStore 读取当前主题模式与切换函数。
 * 不再依赖 Provider，任何组件可直接调用。
 */
export function useTheme(): ThemeContextValue {
  return useThemeStore(useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme })));
}
