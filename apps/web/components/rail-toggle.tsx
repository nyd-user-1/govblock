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

/** What this browser remembers for a rail: closed, open, or nothing yet. */
function remembered(side: Side): "closed" | "open" | null {
  try {
    const v = localStorage.getItem(key(side))
    return v === "closed" || v === "open" ? v : null
  } catch {
    return null
  }
}


function apply(side: Side, closed: boolean) {
  const root = document.documentElement
  if (closed) root.setAttribute(attr(side), "closed")
  else root.removeAttribute(attr(side))
  try {
    localStorage.setItem(key(side), closed ? "closed" : "open")
  } catch {}
}

// One store per side, so the tab on the hairline and the mark in the header
// (2026-09-12) agree on whether the rail is open.
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const isClosed = (side: Side) => (typeof document === "undefined" ? false : document.documentElement.getAttribute(attr(side)) === "closed")

export function setRail(side: Side, closed: boolean) {
  apply(side, closed)
  listeners.forEach((l) => l())
}

export function toggleRail(side: Side) {
  setRail(side, !isClosed(side))
}

/** Whether a rail is closed, live; the page renders open and the remembered state lands on mount. */
export function useRailClosed(side: Side) {
  const closed = React.useSyncExternalStore(subscribe, () => isClosed(side), () => false)
  React.useEffect(() => {
    if (remembered(side) === "closed" && !isClosed(side)) setRail(side, true)
  }, [side])
  return closed
}

export function RailToggle({ side, className }: { side: Side; className?: string }) {
  const closed = useRailClosed(side)
  const toggle = () => toggleRail(side)

  // Pointing at the rail means "close it"; pointing away means "open it".
  const towardRail = side === "left" ? ChevronLeft : ChevronRight
  const awayFromRail = side === "left" ? ChevronRight : ChevronLeft
  const Icon = closed ? awayFromRail : towardRail

  return (
    <button
      type="button"
      data-rail-tab=""
      onClick={toggle}
      aria-label={closed ? `Open the ${side} rail` : `Close the ${side} rail`}
      aria-expanded={!closed}
      className={cn(
        // Hover (Brendan, 2026-09-13): the tab grows about a tenth away from the line, the way the rail will.
        "absolute top-[calc(200px-var(--header-height)-0.6rem)] z-40 flex h-8 w-4 items-center justify-center bg-[#18181b] text-zinc-500 shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-[width,color] duration-200 ease-out select-none hover:w-[17.5px] hover:text-zinc-50",
        // A hovered strip (RailStrip, an earlier sibling of the rail) lights the tab the same way.
        "[[data-rail-strip]:hover~*_&]:w-[17.5px] [[data-rail-strip]:hover~*_&]:text-zinc-50",
        // On the far side of the hairline (right-2 / left-2 is the line): flat where it meets the line, round on the side facing the page.
        side === "left" ? "right-2 translate-x-full rounded-r-[10px]" : "left-2 -translate-x-full rounded-l-[10px]",
        className
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

/**
 * The strip between a closed rail's hairline and the edge of the viewport,
 * made clickable (Brendan, 2026-09-13): the whole height opens the rail, and
 * hovering it lights the tab. Only there while the rail is closed, and only
 * in the sheet frame, where it is placed just before the rail so the tab can
 * see it hovered. 24px wide: the hairline sits 24px in from the viewport's
 * edge (the frame's 8px gutter plus the 16px of strip), and the tab starts
 * at the hairline.
 */
export function RailStrip({ side }: { side: Side }) {
  return (
    <button
      type="button"
      data-rail-strip=""
      aria-label={`Open the ${side} rail`}
      onClick={() => setRail(side, false)}
      className={cn(
        "absolute inset-y-0 z-40 hidden w-6 cursor-pointer",
        side === "left" ? "right-2 [[data-rail-left=closed]_&]:block" : "left-2 [[data-rail-right=closed]_&]:block"
      )}
    />
  )
}
