import { motion } from 'motion/react';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import { NAV_TABS } from '@/constants';
import { preloadRoute } from '@/lib/preload';

const MotionLink = motion.create(Link);

/**
 * 底部页脚组件
 *
 * 包含导航链接、联系方式与版权信息。
 * memo 化：无 props，路由切换时不重渲染。
 */
export default memo(function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] px-6 pb-6 pt-10 text-[0.8125rem] text-text-muted">
      <div className="mx-auto grid max-w-page grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        {/* 导航 */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text)]">
            导航
          </h4>
          <nav className="flex flex-col gap-2">
            {NAV_TABS.map((t) => (
              <MotionLink
                key={t.to}
                to={t.to}
                className="inline-block w-fit text-sm text-text-secondary"
                onMouseEnter={() => { preloadRoute(t.to); }}
                whileHover={{ x: 4, color: 'var(--color-accent)' }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                {t.label}
              </MotionLink>
            ))}
          </nav>
        </div>

        {/* 联系方式 */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text)]">
            联系方式
          </h4>
          <div className="flex flex-col gap-2 [&_.iconfont]:text-[0.9375rem]">
            <motion.a
              href="mailto:your.email@example.com"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent"
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <i className="iconfont icon-youjian" /> 2627675225@qq.com
            </motion.a>
            <motion.a
              href="https://github.com/luo6667"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent"
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <i className="iconfont icon-GitHub" /> GitHub
            </motion.a>
          </div>
        </div>
      </div>

      <p className="mt-8 border-t border-[var(--color-border-light)] pt-4 text-center text-xs">
        &copy; {year} JasonLuo. All rights reserved.
      </p>
    </footer>
  );
});
