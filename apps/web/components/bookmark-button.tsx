"use client"

import * as React from "react"
import { Bookmark as BookmarkIcon } from "lucide-react"

import { isBookmarked, toggleBookmark, useBookmarks } from "@/lib/bookmarks"
import { Button } from "@govblock/ui/components/ny4/button"
import { cn } from "@govblock/ui/lib/utils"

// The bookmark before Copy page (Brendan, 2026-09-20): keeps the page a reader
// is on, at the address they have it — scope and all — in /bookmarks. Filled
// once kept; pressed again, it lets the page go.
export function BookmarkButton({ title, detail }: { title: string; detail: string | null }) {
  const bookmarks = useBookmarks()
  const [href, setHref] = React.useState<string | null>(null)
  // The address is the browser's, so it is read after the page has mounted.
  React.useEffect(() => setHref(window.location.pathname + window.location.search), [])
  const kept = href !== null && isBookmarked(bookmarks, href)
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={kept ? "Remove bookmark" : "Bookmark this page"}
      aria-pressed={kept}
      onClick={() => toggleBookmark({ href: window.location.pathname + window.location.search, title, detail })}
      className={cn("size-8 shadow-none md:size-7", kept && "text-foreground")}
    >
      <BookmarkIcon aria-hidden className={cn(kept && "fill-current")} />
    </Button>
  )
}
