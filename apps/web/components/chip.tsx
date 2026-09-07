"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// The boxed reference in a sentence — a bill number, a committee's official
// name, a person's name — made click-to-copy, as hq's chips are (Brendan,
// 2026-09-06: "when the user clicks the box the text changes green and shows a
// check mark"). The text never changes, so the sentence never reflows; the
// green and the check are the whole affordance, and they go after a moment.
// Dates and counts are not chips: they are not things a reader copies.

export function Chip({ children, copy, className }: { children: React.ReactNode; copy?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<HTMLElement>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  const onCopy = () => {
    const text = copy ?? ref.current?.textContent ?? ""
    if (!text) return
    void navigator.clipboard.writeText(text.trim())
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1200)
  }
  return (
    <code
      ref={ref}
      role="button"
      tabIndex={0}
      title="Copy"
      aria-label={copied ? "Copied" : "Copy"}
      onClick={onCopy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onCopy()
        }
      }}
      data-copied={copied || undefined}
      className={cn("cursor-pointer transition-colors select-none hover:bg-muted", copied && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400", className)}
    >
      {children}
      {copied && <CheckIcon aria-hidden className="ml-1 inline size-3 align-[-0.1em]" />}
    </code>
  )
}
