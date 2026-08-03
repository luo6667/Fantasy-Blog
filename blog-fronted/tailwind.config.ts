import type { Config } from 'tailwindcss'

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--color-accent)',
          soft: 'var(--color-accent-soft)',
        },
        surface: 'var(--color-surface)',
        'bg-alt': 'var(--color-bg-alt)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'border-light': 'var(--color-border-light)',
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      maxWidth: {
        page: '860px',
      },
      borderColor: {
        DEFAULT: 'var(--color-border)',
      },
      textColor: {
        DEFAULT: 'var(--color-text)',
      },
      backgroundColor: {
        DEFAULT: 'var(--color-bg)',
      },
    },
  },
  plugins: [],
} satisfies Config
