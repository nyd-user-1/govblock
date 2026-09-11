"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// The tab on a rail's hairline (Brendan, 2026-09-11): the collapsed dev
// toolbar's tab, to the pixel — 16 by 32, rgb(24,24,27), a 10px radius on the
// side away from the line and flat on the side that meets it, a 16px chevron
// in zinc-500, and its 0 4px 16px shadow. It sits on the page side of the
// separator, flush against it, about 200px from the top of the viewport, and
// opens or closes its rail. The state
// is an attribute on <html> — data-rail-left / data-rail-right = "closed" —
// which the rail, its content and the page grid read through CSS, so no
// context has to reach the three layouts that mount the left rail. Remembered
// per browser.

type Side = "left" | "right"

const attr = (side: Side) => `data-rail-${side}`
const key = (side: Side) => `rail:${side}`

function readClosed(side: Side) {
  try {
    return localStorage.getItem(key(side)) === "closed"
  } catch {
    return false
  }
}

function apply(side: Side, closed: boolean) {
  const root = document.documentElement
  if (closed) root.setAttribute(attr(side), "closed")
  else root.removeAttribute(attr(side))
  try {
    if (closed) localStorage.setItem(key(side), "closed")
    else localStorage.removeItem(key(side))
  } catch {}
}

export function RailToggle({ side, className }: { side: Side; className?: string }) {
  const [closed, setClosed] = React.useState(false)

  // The page renders open; the remembered state lands on mount.
  React.useEffect(() => {
    const stored = readClosed(side)
    if (stored) {
      apply(side, true)
      setClosed(true)
    }
  }, [side])

  const toggle = () => {
    const next = !closed
    apply(side, next)
    setClosed(next)
  }

  // Pointing at the rail means "close it"; pointing away means "open it".
  const towardRail = side === "left" ? ChevronLeft : ChevronRight
  const awayFromRail = side === "left" ? ChevronRight : ChevronLeft
  const Icon = closed ? awayFromRail : towardRail

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={closed ? `Open the ${side} rail` : `Close the ${side} rail`}
      aria-expanded={!closed}
      className={cn(
        "absolute top-[calc(200px-var(--header-height)-0.6rem)] z-40 flex h-8 w-4 items-center justify-center bg-[#18181b] text-zinc-500 shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-colors select-none hover:text-zinc-50",
        // On the far side of the hairline (right-2 / left-2 is the line): flat where it meets the line, round on the side facing the page.
        side === "left" ? "right-2 translate-x-full rounded-r-[10px]" : "left-2 -translate-x-full rounded-l-[10px]",
        className
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
