/** 主题模式 */
export type ThemeMode = 'light' | 'dark';

/** 主题上下文值 */
export interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
}
