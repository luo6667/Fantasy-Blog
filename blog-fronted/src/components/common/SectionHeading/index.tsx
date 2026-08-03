import type { ReactNode } from 'react';

/**
 * 区块标题
 *
 * 统一全站各页面章节标题（"核心技术栈"、"工具与平台"、"教育经历"…）的排版。
 * 可选 iconfont 图标（传 iconfont 类名，如 'icon-banshou'）。
 */
interface SectionHeadingProps {
  children: ReactNode;
  /** iconfont 类名（不含 'iconfont' 前缀），可选 */
  icon?: string;
  className?: string;
}

export default function SectionHeading({ children, icon, className = '' }: SectionHeadingProps) {
  return (
    <p
      className={`mb-5 text-2xl font-bold leading-[1.2] tracking-[-0.02em] text-[var(--color-text)] [&_.iconfont]:text-xl [&_.iconfont]:text-accent ${className}`}
    >
      {icon && <i className={`iconfont ${icon} mr-1`} />}
      {children}
    </p>
  );
}
