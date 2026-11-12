'use client';

import { motion, useInView } from 'motion/react';
import { type ReactNode, useRef } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** 延迟进场（秒），用于编排子元素 stagger */
  delay?: number;
}

/**
 * 滚动进场动画包裹组件
 *
 * 当元素滚动进入视口时上移回位，只动 transform、不做 fade/scale：
 * 内容在 HTML 中立即可见，避免路由切换或首屏出现「空白等动画」。
 * once 确保动画只播放一次。
 */
export default function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ y: 24 }}
      animate={isInView ? { y: 0 } : { y: 24 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
