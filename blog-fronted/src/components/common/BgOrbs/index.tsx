'use client';

import { motion } from 'motion/react';

interface OrbConfig {
  delay: number;
  size: string;
  x: string;
  y: string;
  rotateX: number[];
  rotateY: number[];
}

const orbs: OrbConfig[] = [
  {
    delay: 0,
    size: '28rem',
    x: '-5%',
    y: '-8%',
    rotateX: [0, 15, -10, 5, 0],
    rotateY: [0, -10, 20, -5, 0],
  },
  {
    delay: 3,
    size: '20rem',
    x: '65%',
    y: '50%',
    rotateX: [0, -10, 15, -5, 0],
    rotateY: [0, 20, -15, 10, 0],
  },
  {
    delay: 7,
    size: '16rem',
    x: '40%',
    y: '-5%',
    rotateX: [0, 10, -15, 8, 0],
    rotateY: [0, -5, -20, 10, 0],
  },
];

/** 漂浮小光点 — 3D 深度层 */
const dots = [
  { delay: 0, size: 6, left: '15%', top: '30%', z: -40 },
  { delay: 2, size: 4, left: '75%', top: '20%', z: -30 },
  { delay: 4, size: 5, left: '50%', top: '70%', z: -50 },
  { delay: 6, size: 3, left: '85%', top: '60%', z: -20 },
  { delay: 1, size: 7, left: '30%', top: '80%', z: -35 },
  { delay: 5, size: 4, left: '10%', top: '55%', z: -45 },
];

/** 大光晕的柔边渐变：用径向渐变换掉 120px 高斯模糊，避免大图层反复栅格化 */
const orbGradient =
  'radial-gradient(circle at 50% 50%, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 45%, transparent) 38%, transparent 70%)';

/**
 * 背景 3D 装饰组件
 *
 * 大光晕用渐变模拟柔光 + 3D 旋转，小光点漂浮在不同深度；
 * 只动 transform / opacity，全部交给合成层，不触发重绘。
 */
export default function BgOrbs() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ perspective: '800px' }}
    >
      {/* 大光晕 — 带 3D 旋转 */}
      {orbs.map((o, i) => (
        <motion.div
          key={`orb-${String(i)}`}
          className="absolute rounded-full opacity-[0.09] will-change-transform"
          style={{
            width: o.size,
            height: o.size,
            left: o.x,
            top: o.y,
            background: orbGradient,
          }}
          animate={{
            x: [0, 30, -20, 15, 0],
            y: [0, -25, 20, -15, 0],
            scale: [1, 1.06, 0.94, 1.04, 1],
            rotateX: o.rotateX,
            rotateY: o.rotateY,
          }}
          transition={{
            duration: 16 + o.delay,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: o.delay,
          }}
        />
      ))}

      {/* 小光点 — 不同深度层漂浮 */}
      {dots.map((d, i) => (
        <motion.div
          key={`dot-${String(i)}`}
          className="absolute rounded-full bg-accent will-change-transform"
          style={{
            width: d.size,
            height: d.size,
            left: d.left,
            top: d.top,
            opacity: 0.12,
          }}
          animate={{
            y: [0, -30, -10, -40, 0],
            x: [0, 15, -10, 20, 0],
            opacity: [0.08, 0.18, 0.06, 0.15, 0.08],
            scale: [1, 1.6, 0.8, 1.3, 1],
          }}
          transition={{
            duration: 10 + d.delay,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: d.delay,
          }}
        />
      ))}
    </div>
  );
}
