'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * 图片加载兜底组件（基于 next/image）
 *
 * 图片（尤其是 /uploads/ 下由后端托管的封面图）加载失败时，
 * 用占位色块 + 图标代替碎图，避免影响布局与观感。
 *
 * 尺寸由外部 className 控制（如 h-14 w-20 rounded-lg），内部使用
 * next/image 的 fill 模式，父容器需提供宽高（固定尺寸或 aspect-*）。
 * object-cover 已内置；border / rounded / shadow 等装饰类放在 className 上即可。
 */
interface SafeImgProps {
  src?: string | null;
  alt?: string;
  /** 应用到外层容器的类（尺寸/圆角/边框/阴影等），如 h-14 w-20 rounded-lg */
  className?: string;
  /** 加载失败时的占位提示文案（默认 🖼） */
  fallbackText?: string;
  /** 是否优先加载（首屏大图可传 true） */
  priority?: boolean;
  /** next/image 的 sizes 提示（宽度不固定时建议传，用于生成合理 srcset） */
  sizes?: string;
}

export default function SafeImg({
  src,
  alt,
  className,
  fallbackText = '🖼',
  priority,
  sizes,
}: SafeImgProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  // 无图 / 加载失败：渲染占位块（沿用传入的尺寸类）
  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt ?? '图片'}
        className={`flex items-center justify-center bg-bg-alt text-text-muted/60 ${className ?? ''}`}
      >
        <span className="text-lg leading-none" aria-hidden>
          {fallbackText}
        </span>
      </span>
    );
  }

  return (
    <span className={`relative block overflow-hidden ${className ?? ''}`}>
      <Image
        src={src}
        alt={alt ?? ''}
        fill
        sizes={sizes}
        priority={priority}
        // 后台允许填写站外封面；这类地址不走 Next 的图片优化器，避免未配置
        // remotePatterns 时被 400 拒绝。
        unoptimized={/^https?:\/\//i.test(src)}
        draggable={false}
        className="object-cover"
        onError={() => {
          setFailedSrc(src);
        }}
      />
    </span>
  );
}
