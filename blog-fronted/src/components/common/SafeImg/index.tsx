import { type ImgHTMLAttributes, useState } from 'react';

/**
 * 图片加载兜底组件
 *
 * 图片（尤其是 /uploads/ 下由后端托管的封面图）加载失败时，
 * 用占位色块 + 图标代替碎图，避免影响布局与观感。
 * 尺寸由外部 className 控制（如 h-14 w-20 rounded-lg）。
 */
interface SafeImgProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** 加载失败时的占位提示文案（默认 🖼） */
  fallbackText?: string;
}

export default function SafeImg({ src, alt, className, fallbackText = '🖼', onError, ...rest }: SafeImgProps) {
  const [failed, setFailed] = useState(false);

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
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      draggable={false}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
}
