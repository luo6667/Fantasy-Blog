import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { type MouseEvent } from 'react';

import { favoriteKeys, useFavoriteArticlesQuery } from '@/hooks/queries';
import { articleApi } from '@/lib/api';

/**
 * 收藏下拉面板
 *
 * 展示我收藏的文章列表，点击跳转详情；
 * 每项提供「取消收藏」按钮（复用文章收藏 toggle 接口）。
 */
export default function FavoritesPanel({ onClose }: { onClose: () => void }) {
  const { data: favorites = [], isLoading } = useFavoriteArticlesQuery(true);
  const queryClient = useQueryClient();

  const cancelFavorite = useMutation({
    mutationFn: (id: string) => articleApi.favorite(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  /** 取消收藏（阻止冒泡避免触发 Link 跳转） */
  function handleCancel(e: MouseEvent<HTMLButtonElement>, id: string) {
    e.preventDefault();
    e.stopPropagation();
    cancelFavorite.mutate(id);
  }

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
            <li key={a.id} className="flex items-center gap-2 border-b border-[var(--color-border-light)] last:border-b-0">
              <Link
                href={`/blog/${a.id}`}
                onClick={onClose}
                className="block min-w-0 flex-1 px-4 py-3 transition-colors hover:text-accent"
              >
                <span className="mb-0.5 block truncate text-sm font-medium hover:text-accent">
                  {a.title}
                </span>
                <span className="block text-xs text-text-muted">
                  {a.date}
                  {a.tags.length > 0 ? ` · ${a.tags.join(' / ')}` : ''}
                </span>
              </Link>
              <button
                type="button"
                onClick={(e) => { handleCancel(e, a.id); }}
                disabled={cancelFavorite.isPending}
                className="mr-3 shrink-0 cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-text-muted transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-50"
                title="取消收藏"
              >
                取消收藏
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
