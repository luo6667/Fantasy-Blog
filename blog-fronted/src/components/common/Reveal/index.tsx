'use client';

import { motion, useInView } from 'motion/react';
import { type ReactNode, useRef } from 'react';

import { fadeInFast, springHero } from '@/lib/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** 延迟进场（秒），用于编排子元素 stagger */
  delay?: number;
}

/**
 * 滚动进场动画包裹组件
 *
 * 进入视口后上移回位 + 轻微放大 + 快速淡入：
 * - 透明度用 0.2s tween，避免长时间不可读；
 * - 位移/缩放用弹簧，保留全站统一的弹性观感；
 * - once 确保动画只播放一次。
 */
export default function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 24, scale: 0.985 }}
      transition={{ ...springHero, opacity: { ...fadeInFast, delay }, delay }}
    >
      {children}
    </motion.div>
  );
}
