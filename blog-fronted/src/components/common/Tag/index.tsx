import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { springTag } from '@/lib/motion';

/**
 * 标签胶囊（Tag Pill）
 *
 * 统一全站技能/项目/文章标签的渲染与 hover 交互。
 * - soft：小号强调色软底（首页项目、博客文章、简历项目 meta）
 * - accent：大号强调色软底（关于页核心技术栈）
 * - outline：大号描边（关于页工具与平台）
 */
interface TagProps {
  children: ReactNode;
  /** 视觉变体，默认 soft */
  variant?: 'soft' | 'accent' | 'outline';
  /** 覆盖默认样式 */
  className?: string;
  /** hover 上移距离（px），默认 -2 */
  hoverY?: number;
}

const VARIANTS: Record<NonNullable<TagProps['variant']>, string> = {
  soft: 'inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent',
  accent:
    'rounded-full border border-transparent bg-accent-soft px-3 py-1 text-[0.8125rem] text-accent',
  outline:
    'rounded-full border border-[var(--color-border)] px-3 py-1 text-[0.8125rem] text-text-secondary',
};

export default function Tag({ children, variant = 'soft', className = '', hoverY = -2 }: TagProps) {
  return (
    <motion.span
      className={`${VARIANTS[variant]} ${className}`}
      whileHover={{ scale: 1.12, y: hoverY }}
      whileTap={{ scale: 0.92 }}
      transition={springTag}
    >
      {children}
    </motion.span>
  );
}
