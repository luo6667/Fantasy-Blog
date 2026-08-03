import { useContext } from 'react';

import { ThemeContext } from '@/contexts/ThemeContext';
import type { ThemeContextValue } from '@/types';

/**
 * 主题 Hook
 *
 * 返回当前主题模式与切换函数。
 * 必须在 <ThemeProvider> 内部使用，否则抛出明确错误。
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used within a <ThemeProvider>');
  }
  return ctx;
}
