"use client"

import * as React from "react"
import { ArrowUpIcon } from "lucide-react"

// The circle with the up arrow, bottom right, once the reader has scrolled
// past the first viewport — the opposite of the scroll-to-bottom circle a
// chat shows (Brendan, 2026-09-05). Click returns to the top of the page.
export function BackToTop() {
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <button
      type="button"
      aria-label="Back to top"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      data-shown={shown}
      className="fixed right-6 bottom-6 z-40 inline-flex size-10 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-all hover:bg-muted data-[shown=false]:pointer-events-none data-[shown=false]:translate-y-2 data-[shown=false]:opacity-0 [&_svg]:size-4"
    >
      <ArrowUpIcon />
    </button>
  )
}
