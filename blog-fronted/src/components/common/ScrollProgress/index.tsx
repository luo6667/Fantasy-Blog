import { motion, useScroll, useTransform } from 'motion/react';

/**
 * 滚动进度条组件
 *
 * 固定在页面顶部的细线，随页面滚动从 0% 到 100% 推进。
 * 使用 useScroll 读取全局滚动进度，useTransform 映射到 scaleX。
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-0 z-[1000] h-[3px] origin-left bg-accent"
      style={{ scaleX }}
    />
  );
}
