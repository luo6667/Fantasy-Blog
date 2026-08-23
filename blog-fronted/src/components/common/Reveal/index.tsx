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
 * 当元素滚动进入视口时触发弹簧 scale 弹入 + 淡入 + 上移。
 * 使用 spring 物理曲线，质感自然。once 确保动画只播放一次。
 */
export default function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px 0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{
        opacity: 0,
        y: 32,
        scale: 0.94,
      }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 32, scale: 0.94 }
      }
      transition={{
        duration: 0.7,
        delay,
        type: 'spring',
        stiffness: 100,
        damping: 22,
        mass: 0.5,
      }}
    >
      {children}
    </motion.div>
  );
}
