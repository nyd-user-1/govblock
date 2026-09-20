"use client"

import * as React from "react"
import { Bookmark as BookmarkIcon } from "lucide-react"

import { matchesQuery } from "@/lib/search-match"
import { removeBookmark, useBookmarks } from "@/lib/bookmarks"
import { SearchDirectory } from "@/components/directory-search"
import { RecordItem, RecordList } from "@/components/policy/record-item"

// /bookmarks (Brendan, 2026-09-20): every page a reader has bookmarked, in
// /amendments's layout — the search bar, then the rows. A row carries the
// bookmark where a record's row carries its star, and pressing it lets the
// page go.
export function BookmarksList() {
  const bookmarks = useBookmarks()
  const [query, setQuery] = React.useState("")
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const needle = query.trim().toLowerCase()
  const shown = React.useMemo(() => bookmarks.filter((b) => matchesQuery(needle, b.title, b.detail, b.href)), [bookmarks, needle])

  // Bookmarks live in this browser, so the server has none to draw.
  if (!mounted) return null
  if (!bookmarks.length) return <p className="py-10 text-sm text-muted-foreground">Bookmark a page to keep it here.</p>
  return (
    <>
      <SearchDirectory query={query} setQuery={(value) => setQuery(value ?? "")} placeholder="Search bookmarks by title or description…" />
      <RecordList className="my-8">
        {shown.map((b) => (
          <RecordItem
            key={b.href}
            href={b.href}
            title={b.title}
            meta={[b.href]}
            description={b.detail}
            action={
              <button
                type="button"
                aria-label={`Remove the bookmark on ${b.title}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  removeBookmark(b.href)
                }}
                className="absolute top-3 right-8 inline-flex size-6 items-center justify-center rounded-md text-foreground hover:text-muted-foreground [&_svg]:size-4"
              >
                <BookmarkIcon className="fill-current" />
              </button>
            }
          />
        ))}
      </RecordList>
      <p className="text-sm text-muted-foreground">
        Showing {shown.length} of {bookmarks.length}
        {needle ? ` matching “${query.trim()}”` : ""}.
      </p>
    </>
  )
}
