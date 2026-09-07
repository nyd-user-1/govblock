"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { ComponentActions } from "@/components/card-frame"
import { CardTitle } from "@govblock/ui/components/nova/card"
import { cn } from "@govblock/ui/lib/utils"

// Two things every Admin card carries (Brendan, 2026-09-06): a title that
// copies its own address when clicked — the page's URL with the card's
// anchor — and the standard three-dot menu in the top right, with whatever
// control the card already had sitting to its left.

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export function CardAnchor({ children, id, className }: { children: string; id?: string; className?: string }) {
  const anchor = id ?? slug(children)
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}#${anchor}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <CardTitle id={anchor} className={cn("scroll-mt-20", className)}>
      {/* hq's copy chip (app/ui/copy-code.tsx), as Brendan asked on 2026-09-07: a
          rounded box on the muted ground, violet text, the ground darker on
          hover, and the whole thing green while the link is on the clipboard. */}
      <button
        type="button"
        onClick={copy}
        title="Copy link to this card"
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors select-none focus-visible:outline-1 focus-visible:outline-ring",
          copied ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-muted text-violet-600 hover:bg-muted/70 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
        )}
      >
        {children}
        {copied && <CheckIcon className="size-3.5 text-green-600" />}
      </button>
    </CardTitle>
  )
}

/** The card's controls: whatever it had, then the standard menu. Goes inside CardAction. */
export function CardTools({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <ComponentActions className={className}>{children}</ComponentActions>
}
