'use client';

import Link from 'next/link';

import { Tag } from '@/components/common';
import type { HomeProjectItem } from '@/types/api';

import ProjectCover from './ProjectCover';

/**
 * Selected Work：精选项目
 *
 * 第一个项目作主推（图 + 文横向），其余项目进入不对称双列网格。
 * 卡片不做 3D 倾斜，hover 只有 2px 位移与边框变化。
 */
export default function SelectedWork({ projects }: { projects: HomeProjectItem[] }) {
  if (projects.length === 0) return null;
  const [lead, ...rest] = projects;
  if (!lead) return null;

  return (
    <section id="work" className="border-b border-[var(--color-border)] px-6 py-16 md:py-24">
      <div className="mx-auto max-w-page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
              Selected Work
            </p>
            <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em]">
              精选作品
            </h2>
          </div>
          <Link
            href="/resume"
            className="border-b border-[var(--color-text)]/30 pb-1 text-sm font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            全部项目 →
          </Link>
        </div>

        <article className="group grid overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-accent/40 md:grid-cols-[1.2fr_0.8fr]">
          <ProjectCover project={lead} index={0} className="aspect-[4/3] md:aspect-auto md:h-full" />
          <div className="flex flex-col justify-center p-7 md:p-10">
            <ProjectMeta project={lead} />
            <h3 className="mb-3 mt-4 text-[1.55rem] font-bold leading-[1.25] tracking-[-0.02em]">
              {lead.name}
            </h3>
            <p className="mb-6 text-[0.98rem] leading-[1.8] text-text-muted">{lead.summary}</p>
            <ProjectFooter project={lead} />
          </div>
        </article>

        {rest.length > 0 && (
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {rest.map((project, i) => (
              <article
                key={project.name}
                className="group flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:-translate-y-0.5 hover:border-accent/40"
              >
                <ProjectCover project={project} index={i + 1} className="aspect-[16/10]" />
                <div className="flex flex-1 flex-col p-6">
                  <ProjectMeta project={project} />
                  <h3 className="mb-2 mt-3 text-[1.2rem] font-bold tracking-[-0.02em]">{project.name}</h3>
                  <p className="mb-5 flex-1 text-[0.94rem] leading-[1.75] text-text-muted">
                    {project.summary}
                  </p>
                  <ProjectFooter project={project} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectMeta({ project }: { project: HomeProjectItem }) {
  return (
    <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
      <span className="text-accent">{project.category || 'PROJECT'}</span>
      {project.year && (
        <>
          <span aria-hidden className="h-px w-6 bg-[var(--color-border)]" />
          <span>{project.year}</span>
        </>
      )}
    </p>
  );
}

function ProjectFooter({ project }: { project: HomeProjectItem }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-1.5">
        {project.tags.map((t) => (
          <Tag key={t} className="!px-2 !py-0.5 !text-[0.72rem]">
            {t}
          </Tag>
        ))}
      </div>
      {project.link && (
        <a
          href={project.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-[var(--color-text)]"
        >
          {project.linkLabel || '查看项目'}
          <span aria-hidden>↗</span>
        </a>
      )}
    </div>
  );
}
