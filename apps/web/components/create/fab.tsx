"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"

// The floating pill: dark, rounded, bottom of the stage. One of them on
// /create now — the customizer's hamburger at the left. The block switch and
// the kind switch it used to hold became the tree and the breadcrumb
// (Brendan, 2026-09-03). Same pill the typeset toolbar wears.

// Draggable (Brendan, 2026-09-04): press anywhere on the pill that is not a
// button and move it; the spot is remembered per browser; a double-click on
// the pill puts it back where it started.
const POS_KEY = "govblock:fab:position"

export function Fab({ className, children }: { className?: string; children: React.ReactNode }) {
  // The remembered spot, read through a store so the server and the first
  // client render agree (null) and the stored value arrives on subscription.
  const stored = React.useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify)
      return () => window.removeEventListener("storage", notify)
    },
    () => {
      try {
        return window.localStorage.getItem(POS_KEY)
      } catch {
        return null
      }
    },
    () => null
  )
  const [moved, setPosState] = React.useState<{ x: number; y: number } | null | undefined>(undefined)
  const pos = moved === undefined ? (stored ? (JSON.parse(stored) as { x: number; y: number }) : null) : moved
  const setPos = setPosState
  const drag = React.useRef<{ dx: number; dy: number; moved: boolean } | null>(null)
  const el = React.useRef<HTMLDivElement>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // The grip, or the pill's own padding — never a button.
    if ((e.target as HTMLElement).closest("button, a, input, [role=menuitem]")) return
    const parent = el.current?.offsetParent as HTMLElement | null
    const rect = el.current?.getBoundingClientRect()
    const base = parent?.getBoundingClientRect()
    if (!rect || !base) return
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false }
    el.current?.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const parent = el.current?.offsetParent as HTMLElement | null
    const base = parent?.getBoundingClientRect()
    const rect = el.current?.getBoundingClientRect()
    if (!base || !rect) return
    drag.current.moved = true
    const x = Math.min(Math.max(0, e.clientX - base.left - drag.current.dx), base.width - rect.width)
    const y = Math.min(Math.max(0, e.clientY - base.top - drag.current.dy), base.height - rect.height)
    setPos({ x, y })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    el.current?.releasePointerCapture(e.pointerId)
    if (drag.current.moved && pos) {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(pos))
      } catch {
        // Private mode: the spot lasts for this page.
      }
    }
    drag.current = null
  }
  const reset = () => {
    setPos(null)
    try {
      window.localStorage.removeItem(POS_KEY)
    } catch {
      // Nothing stored.
    }
  }
  return (
    <div
      ref={el}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={reset}
      style={pos ? { left: pos.x, top: pos.y, bottom: "auto", right: "auto" } : undefined}
      className={cn("dark z-20 flex cursor-grab touch-none items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl backdrop-blur-xl select-none active:cursor-grabbing", className)}
      title="Drag to move · double-click to put back"
    >
      <span data-slot="fab-grip" aria-hidden className="flex h-7 w-4 shrink-0 items-center justify-center text-muted-foreground/70">
        <GripVerticalIcon className="size-3.5" />
      </span>
      {children}
    </div>
  )
}

// `tip` names the button on hover, the way /typeset's toolbar names its
// numbered pages — a "04" says nothing on its own.
export function FabButton({ active, tip, className, children, ...props }: React.ComponentProps<typeof Button> & { active?: boolean; tip?: string }) {
  const button = (
    <Button
      variant="ghost"
      size="sm"
      data-active={active}
      className={cn(
        "h-7 min-w-8 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
  if (!tip) return React.cloneElement(button, undefined, children)
  return (
    <Tooltip>
      <TooltipTrigger render={button}>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={10}>
        {tip}
      </TooltipContent>
    </Tooltip>
  )
}
