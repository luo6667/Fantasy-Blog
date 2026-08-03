/**
 * 共享动画配置常量
 *
 * 全站页面统一使用同一套 spring 动画曲线，避免各处重复定义。
 */
import type { Transition, Variants } from 'motion/react';

/** 入场动画：淡入 + 上移 + 轻微模糊（Hero 区、首屏元素通用） */
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 28, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

/** Hero 区入场弹簧（stiffness 100） */
export const springHero: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
  mass: 0.5,
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
  stiffness: 100,
  damping: 20,
  mass: 0.6,
};
