"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"

import { setRail } from "@/components/rail-toggle"

// The right rail's hairline as a resize handle (Brendan, 2026-09-18): the
// sheet still slides over the page as it always has; its line now carries
// shadcn's Resizable grip, and dragging it makes the sheet wider or narrower.
// The width is one variable on <html>, --rail-right-w, which the sheet's
// classes read, so every right rail on the site shares it; the pre-paint
// script (lib/rail-script.ts) lands the remembered width before the rail is
// drawn. Dragged well past its narrowest, the rail closes; a double-click on
// the grip restores the default.

export const RAIL_RIGHT_KEY = "rail:right:width"
const DEFAULT = 288
// The left rail's own width (w-72), which the right one may not go under
// (Brendan, 2026-09-22: "the minimum width of the right rail upon opening
// matches the left rail"). It was 28px narrower, so a dragged rail opened
// short of the line the left one holds.
const MIN = 288
const MAX_SHARE = 0.45

const current = () => {
  const v = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--rail-right-w"
    )
  )
  return Number.isFinite(v) && v > 0 ? v : DEFAULT
}

function apply(width: number, save: boolean) {
  document.documentElement.style.setProperty(
    "--rail-right-w",
    `${Math.round(width)}px`
  )
  if (!save) return
  try {
    localStorage.setItem(RAIL_RIGHT_KEY, String(Math.round(width)))
  } catch {
    // Storage blocked: the width holds for this page only.
  }
}

const clamp = (w: number) =>
  Math.min(Math.max(MIN, window.innerWidth * MAX_SHARE), Math.max(MIN, w))

export function RailResizeHandle() {
  const start = React.useRef<{ x: number; width: number } | null>(null)

  const end = () => {
    if (!start.current) return
    start.current = null
    document.documentElement.removeAttribute("data-rail-resizing")
    apply(current(), true)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the right rail"
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, width: current() }
        // No slide while the reader drags: the sheet follows the pointer.
        document.documentElement.setAttribute("data-rail-resizing", "")
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s) return
        const wanted = s.width + (s.x - e.clientX)
        if (wanted < MIN - 80) {
          start.current = null
          document.documentElement.removeAttribute("data-rail-resizing")
          apply(s.width, true)
          setRail("right", true)
          return
        }
        apply(clamp(wanted), false)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => apply(DEFAULT, true)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        e.preventDefault()
        const step = e.shiftKey ? 64 : 16
        apply(clamp(current() + (e.key === "ArrowLeft" ? step : -step)), true)
      }}
      className="group/handle absolute top-12 bottom-0 left-2 z-40 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-hidden lg:block [[data-rail-right=closed]_&]:hidden"
    >
      <span className="absolute top-1/2 left-1/2 flex h-4 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xs border bg-border group-focus-visible/handle:ring-1 group-focus-visible/handle:ring-ring">
        <GripVerticalIcon className="size-2.5" />
      </span>
    </div>
  )
}
