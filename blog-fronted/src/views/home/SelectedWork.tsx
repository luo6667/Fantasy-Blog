'use client';

import Link from 'next/link';

import { Tag } from '@/components/common';
import type { ArticleListItem, HomeProjectItem } from '@/types/api';

import ProjectCover from './ProjectCover';

/**
 * Selected Work：精选项目
 *
 * 一个主项目整行展示；一个副项目与最近文章并列。
 * 卡片不做 3D 倾斜，hover 只有 2px 位移与边框变化。
 */
export default function SelectedWork({
  projects,
  posts,
}: {
  projects: HomeProjectItem[];
  posts: ArticleListItem[];
}) {
  if (projects.length === 0) return null;
  const [lead, secondary] = projects;
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

        <article className="group grid overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-accent/40 md:min-h-[25rem] md:grid-cols-[1.28fr_0.72fr]">
          <ProjectCover project={lead} index={0} className="aspect-[16/9] md:aspect-auto md:h-full" />
          <div className="flex flex-col justify-center p-7 md:p-10">
            <ProjectMeta project={lead} />
            <h3 className="mb-3 mt-4 text-[clamp(1.7rem,3vw,2.35rem)] font-bold leading-[1.15] tracking-[-0.035em]">{lead.name}</h3>
            <p className="mb-7 max-w-[42ch] text-[0.98rem] leading-[1.8] text-text-muted">{lead.summary}</p>
            <ProjectFooter project={lead} />
          </div>
        </article>

        <div className="mt-6 grid items-stretch gap-6 lg:h-[450px] lg:grid-cols-[1.08fr_0.92fr]">
          {secondary ? <SecondaryProject project={secondary} /> : <div />}
          <LatestPosts posts={posts} />
        </div>

      </div>
    </section>
  );
}

function SecondaryProject({ project }: { project: HomeProjectItem }) {
  return (
    <article className="group flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:-translate-y-0.5 hover:border-accent/40 lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[7fr_3fr]">
      <ProjectCover project={project} index={1} className="aspect-[16/9] lg:h-full lg:aspect-auto" />
      <div className="flex flex-col p-7 md:p-8 lg:min-h-0 lg:flex-1 lg:p-4">
        <ProjectMeta project={project} />
        <h3 className="mb-3 mt-4 text-[1.45rem] font-bold leading-[1.25] tracking-[-0.02em] lg:mb-2 lg:mt-2 lg:text-[1.2rem]">{project.name}</h3>
        <p className="mb-6 flex-1 text-[0.96rem] leading-[1.8] text-text-muted lg:hidden">{project.summary}</p>
        <ProjectFooter project={project} />
      </div>
    </article>
  );
}

function LatestPosts({ posts }: { posts: ArticleListItem[] }) {
  return (
    <aside className="flex h-full flex-col border border-[var(--color-border)] bg-[var(--color-surface)] p-7 md:p-8">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">Latest notes</h3>
        <Link href="/blog" className="text-sm font-medium text-accent hover:underline">全部文章 →</Link>
      </div>
      {posts.length === 0 ? (
        <p className="border-t border-[var(--color-border)] py-8 text-sm text-text-muted">还没有文章，稍后再来看看。</p>
      ) : (
        <ul className="flex-1 border-t border-[var(--color-border)]">
          {posts.map((post) => (
            <li key={post.id} className="border-b border-[var(--color-border)]">
              <Link href={`/blog/${post.id}`} className="group flex items-start justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="mb-1 flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    <span>{post.date}</span><span className="text-accent">{post.primaryTag.name}</span>
                  </span>
                  <span className="block text-[1rem] font-semibold leading-[1.5] tracking-[-0.01em] transition-colors group-hover:text-accent">{post.title}</span>
                </span>
                <span aria-hidden className="mt-1 shrink-0 text-accent transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
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
