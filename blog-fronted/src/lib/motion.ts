/**
 * 共享动画配置常量
 *
 * 全站页面统一使用同一套 spring 动画曲线，避免各处重复定义。
 * 首屏元素只做「短位移 + 快速淡入」：保留弹性观感，但不把内容藏太久，
 * 避免路由切换后看起来像「点了没反应」。
 */
import type { Transition, Variants } from 'motion/react';

/**
 * 入场动画：上移回位 + 快速淡入（Hero 区、首屏元素通用）
 *
 * 透明度用 0.2s tween 快速到位，位移用弹簧收尾，两者分开控制：
 * 文字几乎立刻可读，弹性只体现在最后几像素的位移上。
 */
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

/** 首屏元素的透明度过渡（配合 springHero 使用） */
export const fadeInFast: Transition = {
  duration: 0.2,
  ease: 'easeOut',
};

/** Hero 区入场弹簧：240/26 约 0.4s 收敛，仍有回弹但不会拖沓 */
export const springHero: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 26,
  mass: 0.6,
};

/** 首屏 stagger 容器：子元素间隔 60ms 依次入场 */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

/** 首屏子元素：快速淡入 + 弹簧上移，作为 staggerContainer 的 children 使用 */
export const heroItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ...springHero, opacity: { duration: 0.2 } },
  },
};

/** 按钮 hover/tap 弹簧（stiffness 400） */
export const springBtn: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 15,
};

/** 标签 hover/tap 弹簧（stiffness 500） */
export const springTag: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 15,
};

/** 大质量慢速弹簧（封面页大元素入场） */
export const springSlow: Transition = {
  type: 'spring',
  stiffness: 160,
  damping: 22,
  mass: 0.7,
};
