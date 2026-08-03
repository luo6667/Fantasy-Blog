import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { ThemeContext } from '@/contexts/ThemeContext';
import type { ThemeMode } from '@/types';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * 主题 Provider
 *
 * 管理 light/dark 模式切换，持久化到 localStorage，
 * 并将当前主题注入到 <html data-theme> 属性上驱动 Tailwind 暗色模式。
 */
export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
