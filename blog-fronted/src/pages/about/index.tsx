import { motion } from 'motion/react';

import { BgOrbs, CursorGlow, EducationList, Reveal, SectionHeading, Tag } from '@/components/common';
import { ABOUT_CORE_SKILLS, ABOUT_EDUCATION, ABOUT_TOOL_GROUPS } from '@/constants';
import { springBtn } from '@/lib/motion';

export default function About() {
  return (
    <main>
      <BgOrbs />

      {/* Avatar + Greeting */}
      <motion.section
        className="relative overflow-hidden px-6 pb-8 pt-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <CursorGlow className="z-0" opacity={0.04} />
        <div className="relative z-[1] mx-auto max-w-page">
          <Reveal>
            <div className="flex items-center gap-8">
              <motion.div
                className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft shadow-lg"
                initial={{ scale: 0, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18, mass: 0.6 }}
              >
                <img
                  src="/head.jpg"
                  alt="JasonLuo"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </motion.div>
              <div>
                <motion.p
                  className="mb-0.5 text-sm text-text-muted"
                  initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.1 }}
                >
                  你好，我是
                </motion.p>
                <motion.h1
                  className="mb-1 text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
                  initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.18 }}
                >
                  <span className="text-accent">JasonLuo</span>
                </motion.h1>
                <motion.p
                  className="text-[0.9375rem] text-text-muted"
                  initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.28 }}
                >
                  前端开发，热爱技术与创造。1 年经验，持续学习中。
                </motion.p>
              </div>
            </div>
          </Reveal>
        </div>
      </motion.section>

      {/* 核心技术栈 */}
      <section className="relative z-[1] bg-bg-alt px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-banshou">核心技术栈</SectionHeading>
          </Reveal>
          <div className="mt-5 grid gap-6">
            {ABOUT_CORE_SKILLS.map((g) => (
              <Reveal key={g.label}>
                <div>
                  <h4 className="mb-2 text-[0.9375rem] font-semibold text-[var(--color-text)]">
                    {g.label}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {g.tags.map((t) => (
                      <Tag key={t} variant="accent">
                        {t}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 工具与平台 */}
      <section className="relative z-[1] px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-wangzhi">工具与平台</SectionHeading>
          </Reveal>
          <div className="mt-5 grid gap-6">
            {ABOUT_TOOL_GROUPS.map((g) => (
              <Reveal key={g.label}>
                <div>
                  <h4 className="mb-2 text-[0.9375rem] font-semibold text-[var(--color-text)]">
                    {g.label}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {g.tags.map((t) => (
                      <Tag key={t} variant="outline">
                        {t}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 教育经历 */}
      <section className="relative z-[1] bg-bg-alt px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-book">教育经历</SectionHeading>
          </Reveal>
          <div className="mt-5">
            <EducationList items={ABOUT_EDUCATION} />
          </div>
        </div>
      </section>

      {/* 联系方式 */}
      <section className="relative z-[1] px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-youjian">联系方式</SectionHeading>
          </Reveal>
          <Reveal>
            <div className="mt-5 flex flex-col gap-3">
              <motion.a
                href="mailto:your.email@example.com"
                className="inline-flex items-center gap-2 text-[0.9375rem] text-text-muted"
                whileHover={{ x: 6, color: 'var(--color-accent)' }}
                whileTap={{ scale: 0.95 }}
                transition={springBtn}
              >
                <i className="iconfont icon-youjian text-accent" /> 2627675225@qq.com
              </motion.a>
              <motion.a
                href="https://github.com/luo6667"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[0.9375rem] text-text-muted"
                whileHover={{ x: 6, color: 'var(--color-accent)' }}
                whileTap={{ scale: 0.95 }}
                transition={springBtn}
              >
                <i className="iconfont icon-GitHub text-accent" /> github.com/luo6667
              </motion.a>
              <motion.a
                href="/blog"
                className="inline-flex items-center gap-2 text-[0.9375rem] text-text-muted"
                whileHover={{ x: 6, color: 'var(--color-accent)' }}
                whileTap={{ scale: 0.95 }}
                transition={springBtn}
              >
                <i className="iconfont icon-book text-accent" /> 个人博客
              </motion.a>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
