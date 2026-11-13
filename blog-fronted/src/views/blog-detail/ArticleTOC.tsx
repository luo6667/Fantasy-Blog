'use client'

import { useEffect, useRef, useState } from 'react'

import type { ArticleHeading } from '@/types/api'

const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M3 4.2h10M3 8h10M3 11.8h6" strokeLinecap="round" />
    </svg>
  )
}

/** 目录编号：h2 用中文序号，h3 不编号 */
function headingLabel(headings: ArticleHeading[], index: number) {
  const heading = headings[index]
  if (!heading || heading.level !== 2) return null
  const section = headings.slice(0, index + 1).filter((item) => item.level === 2).length
  const label = CHINESE_NUMERALS[section - 1] ?? String(section)
  return `${label}、`
}

/** 根据滚动位置判断当前章节：取最后一个越过参考线的标题。 */
function useActiveHeading(headings: ArticleHeading[]) {
  const [activeID, setActiveID] = useState(headings[0]?.id ?? '')

  useEffect(() => {
    if (headings.length === 0) return
    let frame = 0

    const update = () => {
      frame = 0
      const reference = Math.min(window.innerHeight * 0.28, 240)
      let current = headings[0]?.id ?? ''
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (!element) continue
        if (element.getBoundingClientRect().top <= reference) current = heading.id
      }
      // 滚到文章末尾时保持最后一个标题高亮
      const last = headings[headings.length - 1]
      const lastElement = last ? document.getElementById(last.id) : null
      if (last && lastElement && lastElement.getBoundingClientRect().top <= reference)
        current = last.id
      setActiveID((previous) => (previous === current ? previous : current))
    }

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [headings])

  return [activeID, setActiveID] as const
}

function DesktopTOC({
  headings,
  activeID,
  onActivate,
}: {
  headings: ArticleHeading[]
  activeID: string
  onActivate: (id: string) => void
}) {
  const listRef = useRef<HTMLOListElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ top: 0, height: 24 })

  // 让指示线与当前条目对齐，并把当前条目滚入目录可视区；
  // 指示线的 top 始终被限制在滚动容器高度内，不会越界。
  useEffect(() => {
    const list = listRef.current
    const scroll = scrollRef.current
    if (!list || !scroll) return

    const sync = () => {
      const target = list.querySelector<HTMLElement>(`[data-heading-id="${activeID}"]`)
      if (!target) return

      const viewport = scroll.clientHeight
      const edge = 12
      const itemHeight = target.offsetHeight

      let nextScroll = scroll.scrollTop
      const itemTop = target.offsetTop - scroll.scrollTop
      const itemBottom = itemTop + itemHeight
      if (itemTop < edge) nextScroll = Math.max(0, target.offsetTop - edge)
      else if (itemBottom > viewport - edge)
        nextScroll = target.offsetTop + itemHeight - viewport + edge

      if (nextScroll !== scroll.scrollTop) {
        scroll.scrollTop = nextScroll
      }

      // 指示线的高度跟随条目高度：条目折成多行时，进度条同步变长
      const height = Math.min(itemHeight, viewport)
      const top = Math.min(Math.max(target.offsetTop - scroll.scrollTop, 0), viewport - height)
      setIndicator((previous) =>
        previous.top === top && previous.height === height ? previous : { top, height },
      )
    }

    // 等目录滚动与布局稳定后再测量
    const frame = window.requestAnimationFrame(sync)
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [activeID, headings])

  return (
    <aside className="fixed right-6 top-24 z-20 hidden w-52 min-[1400px]:block xl:right-8">
      <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
        <span className="h-3.5 w-3.5 text-accent">
          <ListIcon />
        </span>
        本文目录
      </p>
      <div className="relative mt-3 max-h-[calc(100vh-9rem)]">
        <span
          className="pointer-events-none absolute bottom-0 left-0 top-0 w-px bg-[var(--color-border)]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute left-[-0.5px] z-10 w-[1.5px] -translate-x-1/2 rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ top: `${String(indicator.top)}px`, height: `${String(indicator.height)}px` }}
          aria-hidden
        />
        <div
          ref={scrollRef}
          className="max-h-[calc(100vh-9rem)] overflow-y-auto pl-4 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ol ref={listRef}>
            {headings.map((heading, index) => {
              const label = headingLabel(headings, index)
              const active = activeID === heading.id
              return (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    data-heading-id={heading.id}
                    onClick={() => {
                      onActivate(heading.id)
                    }}
                    className={`flex items-baseline gap-2 break-words py-1.5 text-[0.8125rem] leading-6 transition-colors ${
                      active ? 'font-semibold text-accent' : 'text-text-muted hover:text-[var(--color-text)]'
                    }`}
                  >
                    {label && (
                      <span className={`shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`}>
                        {label}
                      </span>
                    )}
                    <span className={label ? '' : 'pl-3'}>{heading.text}</span>
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </aside>
  )
}

function MobileTOC({
  headings,
  activeID,
  onActivate,
}: {
  headings: ArticleHeading[]
  activeID: string
  onActivate: (id: string) => void
}) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [activeID])

  return (
    <nav
      className="mb-8 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1400px]:hidden"
      aria-label="文章目录"
    >
      {headings.map((heading, index) => {
        const label = headingLabel(headings, index)
        const active = activeID === heading.id
        return (
          <a
            key={heading.id}
            ref={active ? activeRef : undefined}
            href={`#${heading.id}`}
            onClick={() => {
              onActivate(heading.id)
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              active
                ? 'border-accent/40 bg-accent-soft font-semibold text-accent'
                : 'border-[var(--color-border)] text-text-muted hover:border-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {label ? `${label}${heading.text}` : heading.text}
          </a>
        )
      })}
    </nav>
  )
}

/** 文章正文目录：h2 / h3 两个层级，桌面吸顶侧栏，窄屏横向标签。 */
export default function ArticleTOC({
  headings,
  variant = 'both',
}: {
  headings: ArticleHeading[]
  variant?: 'mobile' | 'desktop' | 'both'
}) {
  const [activeID, setActiveID] = useActiveHeading(headings)

  if (headings.length === 0) return null

  return (
    <>
      {variant !== 'desktop' && (
        <MobileTOC headings={headings} activeID={activeID} onActivate={setActiveID} />
      )}
      {variant !== 'mobile' && (
        <DesktopTOC headings={headings} activeID={activeID} onActivate={setActiveID} />
      )}
    </>
  )
}

