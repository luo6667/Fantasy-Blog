'use client';

import { motion } from 'motion/react';

import { BgOrbs, EducationList, Reveal, SectionHeading, Tag } from '@/components/common';
import { RESUME_EDUCATION, RESUME_EVALUATION, RESUME_INTERNSHIPS, RESUME_PROJECTS, RESUME_SKILLS } from '@/constants';
import { useSiteContentQuery } from '@/hooks/queries';
import { heroItem, springBtn, staggerContainer } from '@/lib/motion';

export default function Resume() {
  // 内容来自管理后台可编辑的站点内容；未加载 / 加载失败时回退到默认常量，保证页面始终有内容
  const educationQuery = useSiteContentQuery('education');
  const skillsQuery = useSiteContentQuery('skills');
  const internshipsQuery = useSiteContentQuery('internships');
  const projectsQuery = useSiteContentQuery('resumeProjects');
  const evaluationQuery = useSiteContentQuery('evaluation');

  const education = (educationQuery.data?.value as typeof RESUME_EDUCATION | undefined) ?? RESUME_EDUCATION;
  const skills = (skillsQuery.data?.value as string[] | undefined) ?? RESUME_SKILLS;
  const internships = (internshipsQuery.data?.value as typeof RESUME_INTERNSHIPS | undefined) ?? RESUME_INTERNSHIPS;
  const projects = (projectsQuery.data?.value as typeof RESUME_PROJECTS | undefined) ?? RESUME_PROJECTS;
  const evaluation = (evaluationQuery.data?.value as string | undefined) ?? RESUME_EVALUATION;

  return (
    <main>
      <BgOrbs />

      {/* Intro */}
      <section className="px-6 pb-8 pt-16">
        <div className="mx-auto max-w-page">
          <motion.div initial="hidden" animate="show" variants={staggerContainer} className="pb-8">
            <motion.h1
              variants={heroItem}
              className="mb-1.5 text-[clamp(2rem,5vw,2.75rem)] font-extrabold tracking-[-0.03em]"
            >
              <span className="text-accent">Fantasy</span>
            </motion.h1>
            <motion.p
              variants={heroItem}
              className="mb-1 text-base text-text-secondary"
            >
              前端工程师 · 初级全栈开发者
            </motion.p>
            <motion.div
              variants={heroItem}
              className="flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem] text-[var(--color-text)] [&_.iconfont]:text-base"
            >
              <span>
                <i className="iconfont icon-youjian mr-1" /> ljw15875758942@163.com
              </span>
              <span>
                <i className="iconfont icon-GitHub mr-1" /> https://github.com/luo6667
              </span>
            </motion.div>
            <motion.p
              variants={heroItem}
              className="mt-3 border-t border-[var(--color-border-light)] pt-3 text-[0.9375rem] leading-[1.6] text-text-secondary"
            >
              前端开发，热爱技术与创造。1 年学习经验，
              擅长将复杂需求转化为简洁直观的数字产品。
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Education */}
      <section className="relative z-[1] px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-book">教育背景</SectionHeading>
          </Reveal>
          <div className="mt-4">
            <EducationList items={education} />
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="relative z-[1] bg-bg-alt px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-banshou">专业技能</SectionHeading>
          </Reveal>
          <div className="mt-5">
            {skills.map((s) => (
              <Reveal key={s}>
                <div className="mb-3 flex gap-2.5">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <p className="m-0 text-[0.9375rem] leading-[1.65] text-text-muted">{s}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Internships */}
      {internships.length > 0 && (
        <section className="relative z-[1] px-6 py-8">
          <div className="mx-auto max-w-page">
            <Reveal>
              <SectionHeading icon="icon-wenjian">实习经历</SectionHeading>
            </Reveal>
            <div className="mt-5">
              {internships.map((internship, index) => (
                <Reveal key={`${internship.company}-${internship.role}-${internship.period}`}>
                  <motion.div
                    className={`mb-6 pb-6 ${index < internships.length - 1 ? 'border-b border-[var(--color-border-light)]' : ''}`}
                    whileHover={{ x: 6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  >
                    <h4 className="mb-1 text-[1.0625rem] font-semibold">{internship.role}</h4>
                    <p className="mb-3 text-sm font-medium text-text-secondary">{internship.company} · {internship.period}</p>
                    {internship.desc.map((paragraph) => (
                      <div key={paragraph} className="mb-2 flex gap-2">
                        <span className="mt-[0.6rem] h-[5px] w-[5px] shrink-0 rounded-full bg-text-muted" />
                        <p className="m-0 text-sm leading-[1.6] text-text-muted">{paragraph}</p>
                      </div>
                    ))}
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Projects */}
      <section className="relative z-[1] px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-wenjian">项目经历</SectionHeading>
          </Reveal>
          <div className="mt-5">
            {projects.map((p, i) => (
              <Reveal key={p.title}>
                <motion.div
                  className={`mb-6 pb-6 ${i < projects.length - 1 ? 'border-b border-[var(--color-border-light)]' : ''}`}
                  whileHover={{ x: 6 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  <h4 className="mb-1 text-[1.0625rem] font-semibold">{p.title}</h4>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {p.meta.split(' · ').map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                  {p.desc.map((para) => (
                    <div key={para} className="mb-2 flex gap-2">
                      <span className="mt-[0.6rem] h-[5px] w-[5px] shrink-0 rounded-full bg-text-muted" />
                      <p className="m-0 text-sm leading-[1.6] text-text-muted">{para}</p>
                    </div>
                  ))}
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Evaluation */}
      <section className="relative z-[1] bg-bg-alt px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-geren">个人评价</SectionHeading>
            <motion.p
              className="max-w-[38rem] border-l-[3px] border-l-accent pl-4 text-[0.9375rem] leading-[1.65] text-text-muted"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 80, damping: 22, mass: 0.5 }}
            >
              {evaluation}
            </motion.p>
          </Reveal>
        </div>
      </section>

      {/* GitHub */}
      <section className="relative z-[1] bg-bg-alt px-6 py-8">
        <div className="mx-auto max-w-page">
          <Reveal>
            <SectionHeading icon="icon-GitHub">GitHub</SectionHeading>
          </Reveal>
          <Reveal>
            <div className="mt-5">
              <p className="mb-5 max-w-[38rem] text-[0.9375rem] leading-[1.65] text-text-muted">
                我的 GitHub 主页收录了更多开源项目与练手作品。欢迎 Star 和 PR，也期待技术交流。
              </p>
              <motion.a
                href="https://github.com/luo6667"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 rounded-lg border-accent bg-accent-soft px-8 py-[0.875rem] text-base text-accent hover:-translate-y-0.5 hover:bg-accent hover:text-[var(--color-on-accent)]"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.94 }}
                transition={springBtn}
              >
                <i className="iconfont icon-GitHub text-xl" />
                前往 GitHub 主页
              </motion.a>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
