'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ArticleHeading } from '@/types/api'

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M3 4.2h10M3 8h10M3 11.8h6" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function headingLabel(headings: ArticleHeading[], index: number) {
  const heading = headings[index]
  if (!heading || heading.level !== 2) return null
  const section = headings.slice(0, index + 1).filter((item) => item.level === 2).length
  return `${String(section)}.`
}

/** H2 序号由目录统一生成，避免正文手写编号与目录编号重复。 */
function displayHeadingText(heading: ArticleHeading, generatedLabel: string | null) {
  if (!generatedLabel) return heading.text
  return heading.text.replace(/^\s*\d+\s*[.、．:：]\s*/, '')
}

/** 根据正文滚动位置判断当前标题。 */
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
        if (element && element.getBoundingClientRect().top <= reference) current = heading.id
      }
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

/** 将当前目录项放至可视中部；浏览开头和末尾时由浏览器自然截断，避免制造空白。 */
function centerActiveItem(scroll: HTMLElement | null, activeID: string) {
  if (!scroll) return
  const target = scroll.querySelector<HTMLElement>(`[data-heading-id="${activeID}"]`)
  if (!target) return

  const desired = Math.min(
    Math.max(0, target.offsetTop + target.offsetHeight / 2 - scroll.clientHeight / 2),
    Math.max(0, scroll.scrollHeight - scroll.clientHeight),
  )
  scroll.scrollTo({ top: desired, behavior: 'smooth' })
}

function TocEntries({
  headings,
  activeID,
  onActivate,
  inlineMarker = true,
}: {
  headings: ArticleHeading[]
  activeID: string
  onActivate: (id: string) => void
  inlineMarker?: boolean
}) {
  return (
    <ol>
      {headings.map((heading, index) => {
        const label = headingLabel(headings, index)
        const active = activeID === heading.id
        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              data-heading-id={heading.id}
              aria-current={active ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault()
                onActivate(heading.id)
              }}
              className={`flex items-baseline gap-2 break-words py-1.5 text-[0.8125rem] leading-6 transition-colors ${
                active
                  ? 'font-semibold text-accent'
                  : 'text-text-muted hover:text-[var(--color-text)]'
              } ${inlineMarker ? 'relative rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent before:absolute before:inset-y-1 before:-left-4 before:w-0.5 before:rounded-full before:bg-accent before:transition-[opacity,transform] before:duration-150' : ''} ${
                inlineMarker && active
                  ? 'before:scale-y-100 before:opacity-100'
                  : inlineMarker
                    ? 'before:scale-y-75 before:opacity-0'
                    : ''
              }`}
            >
              {label && (
                <span className={`shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`}>
                  {label}
                </span>
              )}
              <span className={label ? '' : 'pl-9'}>{displayHeadingText(heading, label)}</span>
            </a>
          </li>
        )
      })}
    </ol>
  )
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ top: 0, height: 0 })

  const positionIndicator = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const target = content.querySelector<HTMLElement>(`[data-heading-id="${activeID}"]`)
    if (!target) return

    const contentRect = content.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const top = targetRect.top - contentRect.top
    const height = targetRect.height
    setIndicator((previous) =>
      previous.top === top && previous.height === height ? previous : { top, height },
    )
  }, [activeID])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      positionIndicator()
      centerActiveItem(scrollRef.current, activeID)
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [activeID, positionIndicator])

  useEffect(() => {
    const onResize = () => {
      positionIndicator()
      centerActiveItem(scrollRef.current, activeID)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [activeID, positionIndicator])

  return (
    <aside className="fixed right-6 top-24 z-20 hidden w-52 min-[1400px]:block xl:right-8" aria-label="本文目录">
      <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
        <span className="h-3.5 w-3.5 text-accent">
          <ListIcon />
        </span>
        本文目录
      </p>
      <div className="relative mt-3 max-h-[calc(100vh-9rem)]">
        <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--color-border)]" aria-hidden />
        <div
          ref={scrollRef}
          className="max-h-[calc(100vh-9rem)] overflow-y-auto pl-4 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div ref={contentRef} className="relative">
            <span
              className="pointer-events-none absolute -left-4 z-10 w-0.5 rounded-full bg-accent transition-[top,height] duration-300 ease-out"
              style={{ top: `${String(indicator.top)}px`, height: `${String(indicator.height)}px` }}
              aria-hidden
            />
            <TocEntries headings={headings} activeID={activeID} onActivate={onActivate} inlineMarker={false} />
          </div>
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
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      centerActiveItem(scrollRef.current, activeID)
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [activeID, open])

  return (
    <nav className="mb-8 mt-6 rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-alt)]/45 p-3 min-[1400px]:hidden" aria-label="本文目录">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((previous) => !previous)
        }}
        className="flex w-full items-center gap-2 text-left text-xs font-semibold tracking-[0.12em] text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="h-3.5 w-3.5 text-accent">
          <ListIcon />
        </span>
        本文目录
        <span className="ml-auto text-text-muted">
          <ChevronIcon expanded={open} />
        </span>
      </button>
      {open && (
        <div ref={scrollRef} className="scrollbar-slim mt-2 max-h-72 overflow-y-auto border-l border-[var(--color-border)] pl-3 pr-1">
          <TocEntries headings={headings} activeID={activeID} onActivate={onActivate} />
        </div>
      )}
    </nav>
  )
}

/** 文章正文目录：桌面端跟随当前阅读标题，移动端使用外层折叠面板。 */
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
