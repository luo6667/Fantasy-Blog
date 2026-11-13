'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

/** 根据滚动位置判断当前章节：取最后一个越过参考线的标题。
 *  点击目录后到平滑滚动结束前锁定，避免途经的标题让高亮来回跳。 */
function useActiveHeading(headings: ArticleHeading[], lockedRef: { current: boolean }) {
  const [activeID, setActiveID] = useState(headings[0]?.id ?? '')

  useEffect(() => {
    if (headings.length === 0) return
    let frame = 0

    const update = () => {
      frame = 0
      if (lockedRef.current) return
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
  }, [headings, lockedRef])

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
  const [animated, setAnimated] = useState(false)

  // 章节切换时让指示线从旧位置滑到新位置；手动滚目录时立即跟随，避免拖影子。
  useEffect(() => {
    setAnimated(true)
    const timer = window.setTimeout(() => {
      setAnimated(false)
    }, 420)
    return () => {
      window.clearTimeout(timer)
    }
  }, [activeID])

  // 计算指示线位置：高度跟随当前条目（多行时变长），并限制在滚动容器内
  const positionIndicator = useCallback(() => {
    const list = listRef.current
    const scroll = scrollRef.current
    if (!list || !scroll) return
    const target = list.querySelector<HTMLElement>(`[data-heading-id="${activeID}"]`)
    if (!target) return
    const viewport = scroll.clientHeight
    const height = Math.min(target.offsetHeight, viewport)
    const top = Math.min(Math.max(target.offsetTop - scroll.scrollTop, 0), viewport - height)
    setIndicator((previous) =>
      previous.top === top && previous.height === height ? previous : { top, height },
    )
  }, [activeID])

  // 章节变化时（滚动正文或点击目录）把当前条目滚入可视区，再对齐指示线
  useEffect(() => {
    const list = listRef.current
    const scroll = scrollRef.current
    if (!list || !scroll) return
    const target = list.querySelector<HTMLElement>(`[data-heading-id="${activeID}"]`)
    if (!target) return

    const edge = 12
    const viewport = scroll.clientHeight
    const itemTop = target.offsetTop - scroll.scrollTop
    let nextScroll = scroll.scrollTop
    if (itemTop < edge) nextScroll = Math.max(0, target.offsetTop - edge)
    else if (itemTop + target.offsetHeight > viewport - edge)
      nextScroll = target.offsetTop + target.offsetHeight - viewport + edge
    if (nextScroll !== scroll.scrollTop) scroll.scrollTop = nextScroll

    const frame = window.requestAnimationFrame(positionIndicator)
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [activeID, positionIndicator])

  // 手动滚动目录时只重新对齐指示线，不自动滚动目录，避免抽搐
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    let frame = 0
    const onScroll = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        positionIndicator()
      })
    }
    scroll.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame)
      scroll.removeEventListener('scroll', onScroll)
    }
  }, [positionIndicator])

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
          className={`pointer-events-none absolute left-[-0.5px] z-10 w-[1.5px] -translate-x-1/2 rounded-full bg-accent ${
            animated ? 'transition-[top,height] duration-300 ease-out' : ''
          }`}
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
                    onClick={(event) => {
                      event.preventDefault()
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
            onClick={(event) => {
              event.preventDefault()
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
  const lockedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const [activeID, setActiveID] = useActiveHeading(headings, lockedRef)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  // 点击目录：先更新高亮并让指示线滑过去，再平滑滚动正文；滚动期间锁定高亮。
  const activate = useCallback(
    (id: string) => {
      lockedRef.current = true
      setActiveID(id)
      const target = document.getElementById(id)
      if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' })
      window.history.replaceState(null, '', `#${id}`)

      if (timerRef.current) window.clearTimeout(timerRef.current)
      const unlock = () => {
        lockedRef.current = false
      }
      document.addEventListener('scrollend', unlock, { once: true })
      timerRef.current = window.setTimeout(unlock, 900)
    },
    [setActiveID],
  )

  if (headings.length === 0) return null

  return (
    <>
      {variant !== 'desktop' && (
        <MobileTOC headings={headings} activeID={activeID} onActivate={activate} />
      )}
      {variant !== 'mobile' && (
        <DesktopTOC headings={headings} activeID={activeID} onActivate={activate} />
      )}
    </>
  )
}
