import { SafeImg } from '@/components/common';
import type { HomeProjectItem } from '@/types/api';

/**
 * 项目封面
 *
 * 有 cover 时走 next/image（固定比例、懒加载）；没有封面时生成一张静态抽象封面——
 * 纯 SVG 几何图形，不请求任何图片，也不使用滤镜/动画。
 */
export default function ProjectCover({
  project,
  index,
  className = '',
}: {
  project: HomeProjectItem;
  index: number;
  className?: string;
}) {
  if (project.cover) {
    return (
      <div className={`relative overflow-hidden bg-[var(--color-bg-alt)] ${className}`}>
        <SafeImg
          src={project.cover}
          alt={project.coverAlt || `${project.name} 项目封面`}
          sizes="(max-width: 768px) 100vw, 640px"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-[var(--color-bg-alt)] ${className}`}>
      <AbstractCover index={index} label={project.coverAlt || `${project.name} 项目封面`} />
    </div>
  );
}

const palettes = [
  { block: '#1646b8', soft: '#dfe6f7', line: '#c9d3ec' },
  { block: '#1f2a44', soft: '#e8e2d6', line: '#d8d0c2' },
  { block: '#1646b8', soft: '#efe9dd', line: '#d9d2c4' },
  { block: '#243b6b', soft: '#e3e7ef', line: '#ccd3e2' },
];

function AbstractCover({ index, label }: { index: number; label: string }) {
  const p = palettes[index % palettes.length] ?? palettes[0];
  const variant = index % 4;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 480 360"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      <rect width="480" height="360" fill={p?.soft} />
      {variant === 0 && (
        <>
          <circle cx="372" cy="252" r="132" fill={p?.block} />
          <rect x="44" y="44" width="150" height="10" fill={p?.block} opacity="0.9" />
          <rect x="44" y="66" width="96" height="10" fill={p?.block} opacity="0.45" />
          <path d="M44 300 H300" stroke={p?.line} strokeWidth="1" />
          <text x="44" y="332" fill={p?.block} fontSize="12" letterSpacing="4" opacity="0.75">
            SELECTED WORK
          </text>
        </>
      )}
      {variant === 1 && (
        <>
          <rect x="52" y="56" width="212" height="248" fill="#fff" opacity="0.72" />
          <rect x="52" y="56" width="212" height="248" fill="none" stroke={p?.line} />
          <rect x="252" y="0" width="74" height="360" fill={p?.block} opacity="0.92" />
          <circle cx="76" cy="80" r="8" fill={p?.block} />
          <rect x="76" y="112" width="120" height="8" fill={p?.block} opacity="0.55" />
          <rect x="76" y="132" width="160" height="8" fill={p?.line} />
          <rect x="76" y="152" width="140" height="8" fill={p?.line} />
        </>
      )}
      {variant === 2 && (
        <>
          <defs>
            <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.6" fill={p?.line} />
            </pattern>
          </defs>
          <rect x="0" y="0" width="480" height="360" fill="url(#dots)" />
          <path d="M240 360 A120 120 0 0 1 360 240 L360 360 Z" fill={p?.block} />
          <rect x="64" y="64" width="152" height="152" fill="#fff" opacity="0.65" />
          <rect x="64" y="64" width="152" height="152" fill="none" stroke={p?.block} strokeWidth="1.5" />
          <text x="88" y="164" fill={p?.block} fontSize="40" fontWeight="700">
            {String(index + 1).padStart(2, '0')}
          </text>
        </>
      )}
      {variant === 3 && (
        <>
          <rect x="56" y="220" width="368" height="72" fill={p?.block} opacity="0.92" />
          <rect x="56" y="128" width="248" height="72" fill="#fff" opacity="0.8" />
          <rect x="56" y="128" width="248" height="72" fill="none" stroke={p?.line} />
          <rect x="56" y="44" width="140" height="64" fill="#fff" opacity="0.55" />
          <path d="M320 44 h104 v56 h-104 z" fill="none" stroke={p?.block} strokeWidth="1.5" />
          <path d="M320 156 l104 -0" stroke={p?.line} />
        </>
      )}
    </svg>
  );
}
