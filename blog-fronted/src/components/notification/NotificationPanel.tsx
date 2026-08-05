import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

import { useNotificationsQuery } from '@/hooks/queries';
import type { NotificationItem } from '@/types/api';

/**
 * 消息通知下拉面板
 *
 * 展示评论 / 回复 / 收藏三类通知（谁对谁做了什么），
 * 点击跳转对应文章详情。标记已读由父级（Nav）在打开时统一处理。
 */

/** 通知类型 → 字体图标类名（iconfont2 字体族） */
const typeIcon: Record<NotificationItem['type'], string> = {
  comment: 'iconfont2 icon-huifu',
  reply: 'iconfont2 icon-huifu',
  like: 'iconfont2 icon-dianzan',
  favorite: 'iconfont2 icon-shoucangxing',
  article: 'iconfont2 icon-tongzhi',
};

function notificationText(n: NotificationItem): string {
  switch (n.type) {
    case 'comment':
      return `在你的文章《${n.articleTitle ?? '文章'}》下评论了`;
    case 'reply':
      return '回复了你的评论';
    case 'like':
      return `点赞了你的文章《${n.articleTitle ?? ''}》`;
    case 'favorite':
      return `收藏了你的文章《${n.articleTitle ?? ''}》`;
    case 'article':
      return `发布了一篇新文章《${n.articleTitle ?? ''}》`;
  }
}

export default function NotificationPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotificationsQuery(true);

  function handleClick(n: NotificationItem) {
    if (n.articleId) void navigate(`/blog/${n.articleId}`);
    onClose();
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
        消息通知
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">加载中…</p>
      ) : notifications.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">暂无新消息</p>
      ) : (
        <ul className="max-h-[24rem] overflow-y-auto">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => { handleClick(n); }}
                className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-bg-alt"
              >
                <span className="mt-0.5 text-base leading-none">
                  <i className={typeIcon[n.type]} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug">
                    <span className={`font-semibold ${n.read ? 'text-text-secondary' : 'text-accent'}`}>
                      {n.actorName}
                    </span>
                    <span className="text-text-muted">{notificationText(n)}</span>
                  </span>
                  {n.commentContent && (
                    <span className="mt-0.5 block truncate text-xs text-text-muted">
                      「{n.commentContent}」
                    </span>
                  )}
                  <span className="mt-0.5 block text-[0.6875rem] text-text-muted/60">
                    {new Date(n.createdAt).toLocaleString('zh-CN', { hour12: false })}
                  </span>
                </span>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
