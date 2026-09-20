"use client"

import * as React from "react"

import { matchesQuery } from "@/lib/search-match"
import { useFavorites } from "@/lib/favorites"
import { SearchDirectory } from "@/components/directory-search"
import { RecordAvatar, RecordItem, RecordList } from "@/components/policy/record-item"

// /favorites (Brendan, 2026-09-20): everything a reader has starred, in
// /amendments's layout — the search bar, then the rows. A right rail shows
// three of its own page's kind; this is where the rest are. The rows are the
// site's record rows, so each carries its star, and taking the star off takes
// the row off the list.
export function FavoritesList() {
  const favorites = useFavorites()
  const [query, setQuery] = React.useState("")
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const needle = query.trim().toLowerCase()
  const shown = React.useMemo(() => favorites.filter((f) => matchesQuery(needle, f.title, f.detail, f.href)), [favorites, needle])

  // Favorites live in this browser, so the server has none to draw.
  if (!mounted) return null
  if (!favorites.length) return <p className="py-10 text-sm text-muted-foreground">Star an item to keep it here.</p>
  return (
    <>
      <SearchDirectory query={query} setQuery={(value) => setQuery(value ?? "")} placeholder="Search favorites by title or description…" />
      <RecordList className="my-8">
        {shown.map((f) => (
          <RecordItem
            key={f.href}
            href={f.href}
            external={f.external}
            avatar={f.image ? <RecordAvatar src={f.image} /> : undefined}
            title={f.title}
            description={f.detail}
            favoriteDetail={f.detail ?? undefined}
          />
        ))}
      </RecordList>
      <p className="text-sm text-muted-foreground">
        Showing {shown.length} of {favorites.length}
        {needle ? ` matching “${query.trim()}”` : ""}.
      </p>
    </>
  )
}
