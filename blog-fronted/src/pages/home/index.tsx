import { motion, useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import {
  BgOrbs,
  CursorGlow,
  MotionLink,
  Reveal,
  SectionHeading,
  Tag,
  TiltCard,
} from '@/components/common';
import { HOME_PROJECTS } from '@/constants';
import { fadeUp, springBtn, springHero } from '@/lib/motion';

const btnBase =
  'inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-[var(--color-border-light)] bg-[var(--color-bg-alt)] px-[1.25rem] py-2.5 font-[inherit] text-[0.9375rem] font-semibold text-[var(--color-text)] transition-[border-color,color,background,box-shadow] duration-[250ms] hover:border-accent hover:text-accent hover:shadow-md hover:shadow-accent/10';

const STATS = [
  { label: '学习时间', value: 1, suffix: ' 年+' },
  { label: '完成项目', value: 9, suffix: '+' },
  { label: '技术栈', value: 8, suffix: '+' },
];

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const steps = 40;
    const stepTime = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCount(Math.round((target * step) / steps));
      if (step >= steps) {
        setCount(target);
        clearInterval(timer);
      }
    }, stepTime);
    return () => { clearInterval(timer); };
  }, [inView, target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

export default function Home() {
  return (
    <main>
      <BgOrbs />

      {/* Hero */}
      <section className="relative z-[1] overflow-hidden px-6 pb-20 pt-24">
        <CursorGlow className="z-0" />
        <div className="relative z-[1] mx-auto max-w-page">
          <motion.p
            className="mb-2 text-sm font-medium uppercase tracking-[0.06em] text-accent"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, duration: 0.6 }}
          >
            Frontend Developer
          </motion.p>

          <motion.h1
            className="mb-2 text-[clamp(3rem,7vw,5rem)] font-extrabold leading-[1.05] tracking-[-0.01em]"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, duration: 0.7, delay: 0.08 }}
          >
            <span className="text-accent">yourname</span>
          </motion.h1>

          <motion.p
            className="mb-5 text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.2] tracking-[-0.02em] text-accent"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, duration: 0.6, delay: 0.13 }}
          >
            JasonLuo
          </motion.p>

          <motion.p
            className="mb-10 max-w-md text-lg leading-[1.6] text-text-muted"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, duration: 0.6, delay: 0.18 }}
          >
            构建高性能 Web 体验的前端工程师
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ ...springHero, duration: 0.6, delay: 0.28 }}
          >
            <MotionLink
              to="/resume"
              className={btnBase}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.94 }}
              transition={springBtn}
            >
              查看简历
            </MotionLink>
            <MotionLink
              to="/blog"
              className={btnBase}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.94 }}
              transition={springBtn}
            >
              阅读博客
            </MotionLink>
            <motion.a
              href="https://github.com/luo6667"
              target="_blank"
              rel="noreferrer"
              className={btnBase}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.94 }}
              transition={springBtn}
            >
              <i className="iconfont icon-GitHub" /> GitHub
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* 数据统计 */}
      <section className="relative z-[1] bg-bg-alt/30 px-6 py-8">
        <div className="mx-auto max-w-page">
          <div className="grid grid-cols-3 gap-4 text-center">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ ...springHero, delay: i * 0.1 }}
              >
                <span className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold tracking-[-0.02em] text-accent">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </span>
                <span className="text-xs uppercase tracking-[0.06em] text-text-muted">{s.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 精选项目 */}
      <section className="relative z-[1] bg-bg-alt/45 px-6 py-12 backdrop-blur-[1px]">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading>精选项目</SectionHeading>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {HOME_PROJECTS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <TiltCard tiltDegree={6}>
                  <div className="rounded-lg border border-[var(--color-border-light)] bg-surface p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-accent/5">
                    <h3 className="mb-2 text-lg font-semibold tracking-[-0.02em]">{p.name}</h3>
                    <p className="mb-4 text-[0.8125rem] leading-[1.6] text-text-muted">{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags.map((t) => (
                        <Tag key={t} hoverY={-1}>
                          {t}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
