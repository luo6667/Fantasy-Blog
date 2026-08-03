import type { Education } from '@/types';

import Reveal from '../Reveal';

/**
 * 教育经历列表
 *
 * 关于页与简历页共用同一渲染结构：年份 + 专业 + 学校 + 描述，
 * 以分隔线连接，逐条滚动进场。
 */
interface EducationListProps {
  items: Education[];
}

export default function EducationList({ items }: EducationListProps) {
  return (
    <>
      {items.map((item) => (
        <Reveal key={item.title}>
          <div className="border-b border-[var(--color-border-light)] py-5 last:border-b-0">
            <div className="mb-1 text-sm text-text-muted">{item.year}</div>
            <h4 className="mb-1 text-lg font-semibold">{item.title}</h4>
            <div className="mb-1.5 text-sm text-text-muted">{item.school}</div>
            <p className="text-base leading-[1.6] text-text-muted">{item.desc}</p>
          </div>
        </Reveal>
      ))}
    </>
  );
}
