'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';

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
 * 光斑本身是一块固定大小的径向渐变，只通过 transform 平移跟随鼠标。
 * 早期版本每帧重算 `background: radial-gradient(at x y)`，会触发大面积重绘；
 * 现在渐变静态、位移走合成层，视觉一致但开销接近零。
 */
export default function CursorGlow({
  color = 'var(--color-accent)',
  size = 600,
  opacity = 0.06,
  className = '',
}: CursorGlowProps) {
  // 初始放到视口外，避免首次移动前在左上角闪一下
  const rawX = useMotionValue(-size);
  const rawY = useMotionValue(-size);

  // spring 平滑跟随，避免突兀跳动
  const mouseX = useSpring(rawX, { stiffness: 150, damping: 20, mass: 0.5 });
  const mouseY = useSpring(rawY, { stiffness: 150, damping: 20, mass: 0.5 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    rawX.set(e.clientX - rect.left - size / 2);
    rawY.set(e.clientY - rect.top - size / 2);
  };

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} onMouseMove={handleMouseMove}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-full will-change-transform"
        style={{
          width: size,
          height: size,
          x: mouseX,
          y: mouseY,
          opacity,
          background: `radial-gradient(circle at 50% 50%, ${color} 0%, color-mix(in srgb, ${color} 45%, transparent) 40%, transparent 72%)`,
        }}
      />
    </div>
  );
}
