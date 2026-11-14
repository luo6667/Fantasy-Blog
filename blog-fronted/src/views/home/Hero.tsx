'use client';

import { motion, useReducedMotion } from 'motion/react';

import { MotionLink } from '@/components/common';
import { springBtn, springHero } from '@/lib/motion';

function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 3.5h5.5A2 2 0 0 1 11.5 5.5v11H6a2 2 0 0 0-2 2v-15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 3.5h-4.5v13H14a2 2 0 0 0 2-2v-11Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 7h2M6.5 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function RouteIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 3v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="5.2" r="2.1" fill="currentColor" />
      <circle cx="7" cy="10" r="2.1" fill="var(--color-bg-alt)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="14.8" r="2.1" fill="var(--color-bg-alt)" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

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
            className="mb-6 text-[clamp(2rem,4.2vw,2.9rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-[var(--color-text)]"
            initial={initial}
            animate={animate}
            transition={{ ...springHero, duration: 0.6, delay: 0.06 }}
          >
            <span className="block whitespace-nowrap">A Humble</span>
            <span className="block whitespace-nowrap">Full-Stack Developer</span>
          </motion.h1>

          <motion.p
            className="mb-9 max-w-[34ch] text-[1.02rem] leading-[1.8] text-text-muted"
            initial={initial}
            animate={animate}
            transition={{ ...springHero, duration: 0.6, delay: 0.12 }}
          >
            LEARN · CREATE · SHARE · GAIN · GROW
            <br />
            Seek depth, embrace outward
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-x-7 gap-y-4"
            initial={initial}
            animate={animate}
            transition={{ ...springHero, duration: 0.6, delay: 0.18 }}
          >
            <MotionLink
              href="/blog"
              className="group inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-[var(--color-text)]"
              whileHover={reduce ? undefined : { y: -1 }}
              whileTap={reduce ? undefined : { scale: 0.985 }}
              transition={springBtn}
            >
              <BookIcon className="size-4 shrink-0 text-accent" />
              <span>阅读文章</span>
              <ArrowIcon className="size-3.5 shrink-0 text-text-muted transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-accent" />
            </MotionLink>
            <MotionLink
              href="/plan"
              className="group inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-text-muted transition-colors duration-300 hover:text-[var(--color-text)]"
              whileHover={reduce ? undefined : { y: -1 }}
              whileTap={reduce ? undefined : { scale: 0.985 }}
              transition={springBtn}
            >
              <RouteIcon className="size-[1.1rem] shrink-0" />
              <span>查看规划</span>
              <ArrowIcon className="size-3.5 shrink-0 opacity-70 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100" />
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
