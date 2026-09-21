/// <reference types="react/experimental" />
import { ViewTransition } from "react"

// A page that appears in place (Brendan, 2026-09-21). A result chosen from the
// search bar's drop-down is a real navigation — its own URL, the back button,
// the gate, all as they are — that does not look like one: the page being left
// slides up and away, the page arriving rises from below into the same spot,
// and the header stands still over both, so what the reader sees is the next
// section of a long page scrolling into view while the address changes. The
// browser's View Transitions do the work (experimental.viewTransition in
// next.config.ts; the motion is in the UI package's globals.css).
//
// Only a navigation that names the type moves: `router.push(href, {
// transitionTypes: [SEARCH_OPEN] })`. Every other navigation on the site is as
// instant as it was.

export const SEARCH_OPEN = "search-open"

export function PageRise({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={{ [SEARCH_OPEN]: SEARCH_OPEN, default: "none" }} exit={{ [SEARCH_OPEN]: SEARCH_OPEN, default: "none" }} default="none">
      {children}
    </ViewTransition>
  )
}
