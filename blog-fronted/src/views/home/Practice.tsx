'use client';

import Link from 'next/link';

import { GitHubContributions } from '@/components/common';
import type { GitHubContributionsData } from '@/lib/github';
import type { ArticleListItem } from '@/types/api';

/**
 * Continuous Practice：持续创作
 *
 * 左侧 GitHub 贡献热力图，右侧最近 3 篇文章。贡献数据缺失时只隐藏热力图，
 * 文章列表仍然展示，不留空白边框。
 */
export default function Practice({
  contributions,
  posts,
}: {
  contributions: GitHubContributionsData | null;
  posts: ArticleListItem[];
}) {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]/50 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-page">
        <div className="mb-10">
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
            Continuous Practice
          </p>
          <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em]">持续创作</h2>
          <p className="mt-3 max-w-[46ch] text-[0.95rem] leading-[1.8] text-text-muted">
            代码、文章和笔记同时推进。GitHub 记录每天的手感，博客记录想清楚的部分。
          </p>
        </div>

        <div className={`grid gap-8 ${contributions ? 'md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]' : ''}`}>
          {contributions && (
            <div className="min-w-0">
              <GitHubContributions data={contributions} className="!mb-0" />
            </div>
          )}
          <div className="min-w-0">
            <div className="mb-5 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">最近文章</h3>
              <Link href="/blog" className="text-sm font-medium text-accent hover:underline">
                全部文章 →
              </Link>
            </div>
            {posts.length === 0 ? (
              <p className="border-t border-[var(--color-border)] py-8 text-sm text-text-muted">
                还没有文章，稍后再来看看。
              </p>
            ) : (
              <ul className="border-t border-[var(--color-border)]">
                {posts.map((post) => (
                  <li key={post.id} className="border-b border-[var(--color-border)]">
                    <Link
                      href={`/blog/${post.id}`}
                      className="group flex items-start justify-between gap-4 py-4 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="mb-1 flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          <span>{post.date}</span>
                          <span className="text-accent">{post.primaryTag.name}</span>
                        </span>
                        <span className="block text-[1.02rem] font-semibold leading-[1.5] tracking-[-0.01em] transition-colors group-hover:text-accent">
                          {post.title}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className="mt-1 shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
