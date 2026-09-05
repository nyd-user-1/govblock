"use client"

import * as React from "react"
import { ArrowUpIcon } from "lucide-react"

// The circle with the up arrow, once the reader has scrolled past the first
// viewport — the opposite of the scroll-to-bottom circle a chat shows
// (Brendan, 2026-09-05). Centred on the page's main column, as a chat's is
// (Brendan, later that day): it sits at the foot of the column and sticks to
// the bottom of the viewport while the column runs on below it, so it is
// always in the column's middle whatever the rails are doing.
export function BackToTop() {
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <div className="pointer-events-none sticky bottom-6 z-40 flex h-0 w-full justify-center">
      <button
        type="button"
        aria-label="Back to top"
        aria-hidden={!shown}
        tabIndex={shown ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        data-shown={shown}
        className="pointer-events-auto absolute bottom-0 inline-flex size-10 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-all hover:bg-muted data-[shown=false]:pointer-events-none data-[shown=false]:translate-y-2 data-[shown=false]:opacity-0 [&_svg]:size-4"
      >
        <ArrowUpIcon />
      </button>
    </div>
  )
}
