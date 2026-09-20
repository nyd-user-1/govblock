"use client"

import { Star } from "lucide-react"

import { isFavorite, toggleFavorite, useFavorites, type Favorite } from "@/lib/favorites"
import { cn } from "@govblock/ui/lib/utils"

// The star beside a record item's arrow (Brendan, 2026-09-19). What it keeps
// is read off the item as drawn — its bold slot, its description or lead, its
// avatar's image — because the item's title can be a highlighted node rather
// than a string, and the page already rendered the words.
//
// Hidden until the row is hovered or focused, like the arrow; a kept item's
// star stays, filled.

const text = (root: Element, slot: string) => root.querySelector(`[data-record-${slot}]`)?.textContent?.trim() || null

export function FavoriteStar({ href, external = false, className }: { href: string; external?: boolean; className?: string }) {
  const kept = isFavorite(useFavorites(), href)
  return (
    <button
      type="button"
      aria-label={kept ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={kept}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const root = e.currentTarget.closest("[data-record-item]")
        if (!root) return
        toggleFavorite({
          href,
          title: text(root, "title") ?? href,
          // The row's own second line in order of preference; a row with none
          // of its own (a member) names one (favoriteDetail).
          detail: root.getAttribute("data-favorite-detail") || (text(root, "description") ?? text(root, "lead") ?? text(root, "meta")),
          image: root.querySelector("[data-record-avatar] img")?.getAttribute("src") ?? null,
          external,
        })
      }}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md transition-opacity focus-visible:opacity-100 [&_svg]:size-4",
        // Kept, it is yellow (Brendan, 2026-09-19).
        kept ? "text-yellow-400 opacity-100 hover:text-yellow-500" : "text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground",
        className
      )}
    >
      <Star className={cn(kept && "fill-current")} />
    </button>
  )
}

// The same star where there is no record row to read from (Brendan,
// 2026-09-20): a file block's caption, to the right of its copy button. It is
// handed what it keeps, and it always shows.
export function FavoriteToggle({ item, className }: { item: Favorite; className?: string }) {
  const kept = isFavorite(useFavorites(), item.href)
  return (
    <button
      type="button"
      aria-label={kept ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={kept}
      onClick={() => toggleFavorite(item)}
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors [&_svg]:size-4", kept ? "text-yellow-400 hover:text-yellow-500 [&_svg]:opacity-100!" : "text-muted-foreground hover:text-foreground", className)}
    >
      <Star className={cn(kept && "fill-current")} />
    </button>
  )
}
