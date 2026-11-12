'use client';

import { motion } from 'motion/react';

import { EducationList, Reveal, SafeImg, Tag } from '@/components/common';
import { ABOUT_CORE_SKILLS, ABOUT_EDUCATION, ABOUT_PROFILE, ABOUT_TOOL_GROUPS } from '@/constants';
import { springBtn } from '@/lib/motion';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">{children}</p>;
}

export default function About() {
  return (
    <main className="overflow-hidden">
      <section className="border-b border-[var(--color-border)] px-6 pb-14 pt-20 md:pb-20 md:pt-28">
        <div className="mx-auto grid max-w-page gap-10 lg:grid-cols-[0.68fr_1.32fr] lg:gap-16">
          <Reveal>
            <div className="flex items-start gap-5 lg:block">
              <div className="h-24 w-24 shrink-0 overflow-hidden border border-[var(--color-border)] bg-accent-soft p-1 lg:h-36 lg:w-36">
                <SafeImg src="/head.jpg" alt="Fantasy 的头像" priority sizes="144px" className="h-full w-full" />
              </div>
              <div className="pt-1 lg:mt-6">
                <Eyebrow>{ABOUT_PROFILE.eyebrow}</Eyebrow>
                <p className="mt-2 text-sm text-text-muted">Independent creator</p>
              </div>
            </div>
          </Reveal>

          <div>
            <Reveal>
              <p className="text-sm text-text-muted">你好，我是</p>
              <h1 className="mt-1 text-[clamp(3.1rem,8vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.065em] text-[var(--color-text)]">
                {ABOUT_PROFILE.name}
              </h1>
              <p className="mt-5 text-[1.05rem] font-medium text-accent">{ABOUT_PROFILE.role}</p>
              <p className="mt-5 max-w-[62ch] text-[1rem] leading-[1.9] text-text-muted">{ABOUT_PROFILE.intro}</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--color-border)] px-6 py-14 md:py-20">
        <div className="mx-auto max-w-page">
          <Reveal><Eyebrow>Now / 当前关注</Eyebrow></Reveal>
          <div className="mt-6 grid border-l border-t border-[var(--color-border)] md:grid-cols-2">
            {ABOUT_PROFILE.focus.map((item) => (
              <Reveal key={item.title}>
                <article className="min-h-44 border-b border-r border-[var(--color-border)] p-6 md:p-8">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                  <p className="mt-4 max-w-[30ch] text-[1rem] leading-[1.8] text-text-muted">{item.content}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <blockquote className="mt-12 max-w-[50rem] border-l-2 border-accent pl-5 text-[clamp(1.25rem,2.5vw,1.8rem)] font-semibold leading-[1.55] tracking-[-0.025em] text-[var(--color-text)]">
              “{ABOUT_PROFILE.pointOfView}”
            </blockquote>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-[var(--color-border)] px-6 py-14 md:py-20">
        <div className="mx-auto grid max-w-page gap-12 lg:grid-cols-[0.68fr_1.32fr] lg:gap-16">
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <Eyebrow>Capability / 能力地图</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] font-extrabold tracking-[-0.04em]">把复杂的事，做得清楚一点。</h2>
            </div>
          </Reveal>
          <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {ABOUT_CORE_SKILLS.map((group) => (
              <Reveal key={group.label}>
                <article className="grid gap-4 py-6 md:grid-cols-[10rem_1fr] md:gap-8">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{group.label}</h3>
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => <Tag key={tag} variant="accent">{tag}</Tag>)}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:py-20">
        <div className="mx-auto grid max-w-page gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Reveal><Eyebrow>Toolkit / 工作方式</Eyebrow></Reveal>
            <div className="mt-6 space-y-5">
              {ABOUT_TOOL_GROUPS.map((group) => (
                <Reveal key={group.label}>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{group.label}</h3>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="space-y-12">
            <div>
              <Reveal><Eyebrow>Education / 教育</Eyebrow></Reveal>
              <div className="mt-6"><EducationList items={ABOUT_EDUCATION} /></div>
            </div>
            <Reveal>
              <div className="border-t border-[var(--color-border)] pt-7">
                <Eyebrow>Contact / 联系</Eyebrow>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
                  <motion.a href="mailto:ljw15875758942@163.com" className="text-text-muted hover:text-accent" whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }} transition={springBtn}>ljw15875758942@163.com</motion.a>
                  <motion.a href="https://github.com/luo6667" target="_blank" rel="noreferrer" className="text-text-muted hover:text-accent" whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }} transition={springBtn}>GitHub ↗</motion.a>
                  <motion.a href="/blog" className="text-text-muted hover:text-accent" whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }} transition={springBtn}>博客文章 →</motion.a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}
