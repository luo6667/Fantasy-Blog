'use client';

import { motion, useReducedMotion } from 'motion/react';

import { MotionLink } from '@/components/common';
import { springBtn, springHero } from '@/lib/motion';

/**
 * 首页 Hero：创作宣言 + 静态几何拼贴
 *
 * - 首屏文字不依赖动画即可读；减少动态偏好时直接静态呈现；
 * - 右侧拼贴全部是 CSS 几何块，不加载图片/视频，也不使用模糊滤镜。
 */
export default function Hero() {
  const reduce = useReducedMotion();
  const initial = reduce ? false : { y: 16 };
  const animate = { opacity: 1, y: 0 };

  return (
    <section className="relative border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6">
      <div className="mx-auto grid max-w-page items-center gap-10 py-16 md:grid-cols-[1.15fr_0.85fr] md:gap-14 md:py-24">
        <div>
          <motion.p
            className="mb-6 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent"
            initial={initial}
            animate={animate}
            transition={{ ...springHero, duration: 0.5 }}
          >
            Independent Creator / 2026
          </motion.p>

          <motion.h1
            className="mb-6 text-[clamp(2.35rem,5vw,3.7rem)] font-extrabold leading-[1.14] tracking-[-0.035em] text-[var(--color-text)]"
            initial={initial}
            animate={animate}
            transition={{ ...springHero, duration: 0.6, delay: 0.06 }}
          >
            把想法做成
            <br />
            值得停留的作品
          </motion.h1>

          <motion.p
            className="mb-9 max-w-[34ch] text-[1.02rem] leading-[1.8] text-text-muted"
            initial={initial}
            animate={animate}
            transition={{ ...springHero, duration: 0.6, delay: 0.12 }}
          >
            用产品思维与设计审美，持续记录工具、内容和个人成长。
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-x-7 gap-y-4"
            initial={initial}
            animate={animate}
            transition={{ ...springHero, duration: 0.6, delay: 0.18 }}
          >
            <MotionLink
              href="#work"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-text)]"
              whileHover={reduce ? undefined : { y: -1 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={springBtn}
            >
              浏览作品 <span aria-hidden>↘</span>
            </MotionLink>
            <MotionLink
              href="/blog"
              className="border-b border-[var(--color-text)]/30 pb-1 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-accent hover:text-accent"
              whileHover={reduce ? undefined : { y: -1 }}
              transition={springBtn}
            >
              阅读文章 →
            </MotionLink>
          </motion.div>
        </div>

        <div aria-hidden className="relative mx-auto hidden aspect-[4/3.2] w-full max-w-[420px] md:block">
          {/* 纸张底卡 */}
          <div className="absolute inset-x-3 top-4 bottom-6 -rotate-2 border border-[var(--color-border)] bg-[var(--color-surface)]" />
          {/* 细网格 */}
          <div
            className="absolute inset-x-3 top-4 bottom-6 -rotate-2"
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--color-border-light) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-light) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* 钴蓝圆 */}
          <div className="absolute -right-2 bottom-2 h-40 w-40 rounded-full bg-accent" />
          {/* 圆环 */}
          <div className="absolute left-4 top-6 h-24 w-24 rounded-full border border-accent/40" />
          {/* 索引 */}
          <div className="absolute left-10 top-12 text-[3.4rem] font-extrabold leading-none tracking-[-0.05em] text-accent">
            01
          </div>
          {/* 说明条 */}
          <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-text-muted">
            <span>Work / Notes</span>
            <span>2026</span>
          </div>
        </div>
      </div>
    </section>
  );
}
