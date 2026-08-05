import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { useFavoriteArticlesQuery } from '@/hooks/queries';

/**
 * 收藏下拉面板
 *
 * 展示我收藏的文章列表，点击跳转详情。
 */
export default function FavoritesPanel({ onClose }: { onClose: () => void }) {
  const { data: favorites = [], isLoading } = useFavoriteArticlesQuery(true);

  return (
    <motion.div
      className="absolute right-[-5.5rem] top-[calc(100%+0.5rem)] z-[950] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      <div className="border-b border-[var(--color-border-light)] px-4 py-2.5 text-sm font-semibold">
        我的收藏
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">加载中…</p>
      ) : favorites.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">还没有收藏任何文章</p>
      ) : (
        <ul className="max-h-[24rem] overflow-y-auto">
          {favorites.map((a) => (
            <li key={a.id}>
              <Link
                to={`/blog/${a.id}`}
                onClick={onClose}
                className="block px-4 py-3 transition-colors hover:bg-bg-alt"
              >
                <span className="mb-0.5 block truncate text-sm font-medium hover:text-accent">
                  {a.title}
                </span>
                <span className="block text-xs text-text-muted">
                  {a.date}
                  {a.tags.length > 0 ? ` · ${a.tags.join(' / ')}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
