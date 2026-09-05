"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

// The anchor beside a section heading. The heading is a link to its own
// anchor, and the glyph beside it is lucide.dev's: a copy icon that appears
// on hover and, when clicked, puts the section's full URL on the clipboard,
// showing a check for a moment. Brendan, 2026-09-05: "change these from # to
// [the copy icon]... allowing the user to click to copy."

export function HeadingAnchor({ id, children }: { id?: string; children: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false)
  if (!id) return children

  async function copy(event: React.MouseEvent) {
    event.preventDefault()
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${id}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="group inline-flex items-center gap-2">
      <a className="no-underline underline-offset-4 hover:underline" href={`#${id}`}>
        {children}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy link to this section"}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 [&_svg]:size-4"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </span>
  )
}
