'use client';

import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react';
import { useCallback } from 'react';

interface CursorGlowProps {
  /** 光晕颜色，默认使用 CSS 变量 --color-accent */
  color?: string;
  /** 光晕大小，默认 600px */
  size?: number;
  /** 光晕透明度，默认 0.06 */
  opacity?: number;
  className?: string;
}

/**
 * 鼠标跟随光晕组件
 *
 * 在指定区域内创建一个跟随鼠标移动的径向渐变光斑，
 * 使用 spring 实现平滑跟随，营造柔和的聚光灯效果。
 */
export default function CursorGlow({
  color = 'var(--color-accent)',
  size = 600,
  opacity = 0.06,
  className = '',
}: CursorGlowProps) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // spring 平滑跟随，避免突兀跳动
  const mouseX = useSpring(rawX, { stiffness: 150, damping: 20, mass: 0.5 });
  const mouseY = useSpring(rawY, { stiffness: 150, damping: 20, mass: 0.5 });

  const background = useMotionTemplate`radial-gradient(${size}px at ${mouseX}px ${mouseY}px, ${color}, transparent 80%)`;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      rawX.set(e.clientX - rect.left);
      rawY.set(e.clientY - rect.top);
    },
    [rawX, rawY],
  );

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} onMouseMove={handleMouseMove}>
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background, opacity }}
      />
    </div>
  );
}
