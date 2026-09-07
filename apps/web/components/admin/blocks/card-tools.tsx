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

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

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
      <button type="button" onClick={copy} title="Copy link to this card" className="inline-flex items-center gap-1.5 rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-1 focus-visible:outline-ring">
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
