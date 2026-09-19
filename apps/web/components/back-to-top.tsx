"use client"

import * as React from "react"
import { ArrowUpIcon } from "lucide-react"

// The circle with the up arrow, once the reader has scrolled past the first
// viewport — the opposite of the scroll-to-bottom circle a chat shows
// (Brendan, 2026-09-05). Centred on the page's main column, as a chat's is
// (Brendan, later that day): it sits at the foot of the column and sticks to
// the bottom of the viewport while the column runs on below it, so it is
// always in the column's middle whatever the rails are doing.
// `scroller` names a box that scrolls on its own (the /live stream, Brendan,
// 2026-09-15); the circle then sits at that box's foot and answers its scroll.
// Unnamed, the nearest ancestor that scrolls on its own is found (2026-09-18:
// the rails frame's column scrolls itself, not the window), and the window
// answers when there is none.
function scrollingAncestor(from: HTMLElement | null) {
  for (let el = from?.parentElement ?? null; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === "auto" || overflowY === "scroll") return el
  }
  return null
}

export function BackToTop({ scroller }: { scroller?: () => HTMLElement | null } = {}) {
  const [shown, setShown] = React.useState(false)
  const box = React.useRef<HTMLElement | null>(null)
  const self = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = scroller ? scroller() : scrollingAncestor(self.current)
    box.current = el
    const onScroll = () => setShown(el ? el.scrollTop > el.clientHeight : window.scrollY > window.innerHeight)
    onScroll()
    const target: HTMLElement | Window = el ?? window
    target.addEventListener("scroll", onScroll, { passive: true })
    return () => target.removeEventListener("scroll", onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={self} className="pointer-events-none sticky bottom-6 z-40 flex h-0 w-full justify-center">
      <button
        type="button"
        aria-label="Back to top"
        aria-hidden={!shown}
        tabIndex={shown ? 0 : -1}
        onClick={() => (box.current ?? window).scrollTo({ top: 0, behavior: "smooth" })}
        data-shown={shown}
        className="pointer-events-auto absolute bottom-0 inline-flex size-10 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-all hover:bg-muted data-[shown=false]:pointer-events-none data-[shown=false]:translate-y-2 data-[shown=false]:opacity-0 [&_svg]:size-4"
      >
        <ArrowUpIcon />
      </button>
    </div>
  )
}
