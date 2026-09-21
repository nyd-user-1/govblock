"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

// Marks <html> with data-scrolled while the page is scrolled past the top
// (Brendan, 2026-09-13), so the sticky header can wear a shadow only once
// something is passing under it.
//
// The page is not always the window (Brendan, 2026-09-21: "how come it
// doesn't show on the root page again?"). The root scrolls inside the particle
// scroller's own box, the window never moves there, and the header never
// learned anything was under it. A box that is the page's scroller says so
// with `data-page-scroller`, and its scroll counts as the page's. Scroll
// events do not bubble, so they are caught on the way down; a box that scrolls
// for some other reason — a calendar, a menu — carries no mark and casts no
// shade. The path is a dependency because a marked box leaves with its page,
// silently, and the next page must not inherit its shade.
export function ScrollShade() {
  const pathname = usePathname()
  React.useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const scrolled = window.scrollY > 0 || Array.from(document.querySelectorAll<HTMLElement>("[data-page-scroller]")).some((el) => el.scrollTop > 0)
      if (scrolled) root.setAttribute("data-scrolled", "")
      else root.removeAttribute("data-scrolled")
    }
    const onScroll = (event: Event) => {
      const target = event.target
      if (target === document || target === window || (target instanceof HTMLElement && target.hasAttribute("data-page-scroller"))) apply()
    }
    apply()
    document.addEventListener("scroll", onScroll, { passive: true, capture: true })
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true })
      root.removeAttribute("data-scrolled")
    }
  }, [pathname])
  return null
}
