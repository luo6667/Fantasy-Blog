'use client';

import { motion, useReducedMotion } from 'motion/react';

import { MotionLink } from '@/components/common';
import { springBtn, springHero } from '@/lib/motion';

import DeskCat from './DeskCat';

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

function PersonIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="6.6" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.2 17c.4-3.1 2.9-5 5.8-5s5.4 1.9 5.8 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 首页 Hero：创作宣言 + 敲代码的 CC 猫循环动图
 *
 * - 首屏文字不依赖动画即可读；减少动态偏好时直接静态呈现；
 * - 右侧为循环 GIF；减少动态或页面不可见时显示静态图。
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
            Actions speak louder than words
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
              href="/about"
              className="group inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-text-muted transition-colors duration-300 hover:text-[var(--color-text)]"
              whileHover={reduce ? undefined : { y: -1 }}
              whileTap={reduce ? undefined : { scale: 0.985 }}
              transition={springBtn}
            >
              <PersonIcon className="shrink-0" />
              <span>关于作者</span>
              <ArrowIcon className="size-3.5 shrink-0 opacity-70 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100" />
            </MotionLink>
          </motion.div>
        </div>

        <DeskCat />
      </div>
    </section>
  );
}
