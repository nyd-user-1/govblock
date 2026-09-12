"use client"

import * as React from "react"

import { AnimateIcon } from "@govblock/ui/components/animate-ui/icons/icon"
import { LogoMark } from "@/components/logo-mark"
import { toggleRail, useRailClosed } from "@/components/rail-toggle"

// The mark, at the left of the header (Brendan, 2026-09-12): 30px, and a
// button — it opens and closes the left rail, the way the tab on the rail's
// hairline does. The blocks move on hover as they do in the menus.
export function LogoButton({ className }: { className?: string }) {
  const closed = useRailClosed("left")
  return (
    <AnimateIcon asChild animateOnHover>
      <button
        type="button"
        onClick={() => toggleRail("left")}
        aria-label={closed ? "Open the sidebar" : "Close the sidebar"}
        aria-pressed={!closed}
        className={className ?? "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"}
      >
        <LogoMark className="size-[30px] shrink-0" aria-hidden />
      </button>
    </AnimateIcon>
  )
}
