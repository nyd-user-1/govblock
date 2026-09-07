"use client"

import { Search } from "lucide-react"

// The big search under the greeting (Brendan, 2026-09-07: Cloudflare's
// account home). It is the site's ⌘K menu, opened by a click: the menu
// listens for the key, so the box sends it.
export function HomeSearch() {
  const open = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))
  return (
    <button type="button" onClick={open} className="flex h-14 w-full items-center gap-3 rounded-2xl border bg-background px-4 text-left text-base text-muted-foreground shadow-xs ring-4 ring-muted/60 transition-colors hover:bg-muted/30">
      <Search className="size-5 shrink-0" />
      <span className="flex-1">Search</span>
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">⌘</kbd>
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">K</kbd>
    </button>
  )
}
