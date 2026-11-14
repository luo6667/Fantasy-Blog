'use client';

import { GitHubContributions } from '@/components/common';
import type { ContributionsData } from '@/lib/contributions';

/**
 * Continuous Practice：持续创作
 *
 * GitHub 贡献图独占一整行，和作品、文章流分开，使每周节奏更容易被浏览。
 */
export default function Practice({
  contributions,
}: {
  contributions: ContributionsData | null;
}) {
  if (!contributions) return null;

  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]/50 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-page">
        <div className="mb-10">
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
            Continuous Practice
          </p>
          <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em]">持续创作</h2>
          <p className="mt-3 max-w-[46ch] text-[0.95rem] leading-[1.8] text-text-muted">
            全栈开发、项目实践与技术写作并行。代码足迹留存每日工程积累，博客整理沉淀后的方法论
          </p>
        </div>

        <GitHubContributions data={contributions} className="!mb-0 w-full" />
      </div>
    </section>
  );
}
