import { motion } from 'motion/react';
import Link from 'next/link';

import { NAV_TABS } from '@/constants';

const MotionLink = motion.create(Link);
const motionConfig = { type: 'spring', stiffness: 400, damping: 18 } as const;
const NAV_ICONS = ['icon-wangzhi', 'icon-book', 'icon-banshou', 'icon-wenjian', 'icon-geren'] as const;

/** 主站底栏：品牌、站内导航与联系信息三栏收束。 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] px-6 pb-5 pt-14 text-[0.8125rem] text-text-muted md:pt-16">
      <div className="mx-auto grid max-w-page gap-10 md:grid-cols-[1.2fr_0.8fr_1fr] md:gap-12">
        <section>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">Independent creator</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">Fantasy</h2>
          <p className="mt-4 max-w-[26ch] text-base leading-[1.7] text-text-secondary">
            Seek depth
            <br />
            Embrace outward
          </p>
        </section>

        <section>
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">Navigate / 浏览</h2>
          <nav className="mt-4 flex flex-col gap-3" aria-label="页脚导航">
            {NAV_TABS.map((tab, index) => (
              <MotionLink
                key={tab.to}
                href={tab.to}
                className="inline-flex w-fit items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent"
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.96 }}
                transition={motionConfig}
              >
                <i className={`iconfont ${NAV_ICONS[index] ?? 'icon-wangzhi'} text-[0.9rem]`} aria-hidden="true" />
                {tab.label}
              </MotionLink>
            ))}
          </nav>
        </section>

        <section>
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">Contact / 联系方式</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <motion.a
              href="mailto:ljw15875758942@163.com"
              className="inline-flex items-center gap-1.5 text-text-secondary transition-colors hover:text-accent"
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.96 }}
              transition={motionConfig}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[0.95rem] w-[0.95rem] shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5.5" width="18" height="13" rx="2.6" />
                <path d="m3.7 7.4 7.2 4.9a2 2 0 0 0 2.2 0l7.2-4.9" />
              </svg> ljw15875758942@163.com
            </motion.a>
            <motion.a
              href="https://github.com/luo6667"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-text-secondary transition-colors hover:text-accent"
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.96 }}
              transition={motionConfig}
            >
              <i className="iconfont icon-GitHub text-[0.95rem]" aria-hidden="true" /> GitHub ↗
            </motion.a>
          </div>
        </section>
      </div>

      <div className="mx-auto mt-12 max-w-page border-t border-[var(--color-border-light)] pt-4 text-center text-xs">
        <p>© {year} Fantasy. All rights reserved.</p>
      </div>
    </footer>
  );
}
