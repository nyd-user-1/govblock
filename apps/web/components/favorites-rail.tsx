"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Star } from "lucide-react"

import { favoritesFor, removeFavorite, updateFavorite, useFavorites, type Favorite } from "@/lib/favorites"
import { memberLine } from "@/lib/legislative-body"
import { cn } from "@govblock/ui/lib/utils"

// The right rail's Favorites (Brendan, 2026-09-19): as a general rule the
// right rail is the favorites rail, and Favorites heads it, above the page's
// own block. Drawn in the contents block's type: the small muted heading, the
// small links. The page's own (Brendan, 2026-09-20): the ones starred in this
// section of the site, three at most, the count beside the heading when there
// are more; all of them are on /favorites, which took the chevron's place. The
// empty line waits for the browser, so a reader with favorites never sees it
// flash.

const SHOWN = 3

// A member kept before members had a second line (2026-09-19) has none
// stored; the rail asks for the member once and writes party, state and
// district in, so every member favorite reads like the rest.
function useMemberLines(favorites: Favorite[]) {
  const asked = React.useRef(new Set<string>())
  React.useEffect(() => {
    for (const f of favorites) {
      const id = /^\/members\/(\d+)/.exec(f.href)?.[1]
      if (!id || f.detail || asked.current.has(f.href)) continue
      asked.current.add(f.href)
      const state = new URL(f.href, window.location.origin).searchParams.get("state") ?? "US"
      fetch(`/api/policy/member?state=${state}&id=${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m: { party?: string; state?: string; district?: string } | null) => {
          const line = m ? memberLine(m) : ""
          if (line) updateFavorite(f.href, { detail: line })
        })
        .catch(() => {})
    }
  }, [favorites])
}

export function FavoritesRail({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/"
  const all = useFavorites()
  const favorites = React.useMemo(() => favoritesFor(all, pathname), [all, pathname])
  useMemberLines(favorites)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return (
    <div className={cn("flex flex-col gap-2 p-4 pt-0 text-sm", className)}>
      <div className="flex h-6 items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Favorites{favorites.length > SHOWN ? ` · ${favorites.length}` : ""}
        </p>
      </div>
      {favorites.length === 0
        ? mounted && <p className="text-[0.8rem] text-muted-foreground">Star an item to keep it here.</p>
        : favorites.slice(0, SHOWN).map((f) => (
            <div key={f.href} className="group/fav relative flex items-start gap-2">
              {f.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.image} alt="" className="mt-0.5 size-4 shrink-0 rounded-[3px] object-cover" />
              )}
              <Link
                href={f.href}
                {...(f.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex min-w-0 flex-1 flex-col pr-5 no-underline"
              >
                <span className="truncate text-[0.8rem] font-medium text-foreground">{f.title}</span>
                {f.detail && <span className="truncate text-[0.75rem] text-muted-foreground">{f.detail}</span>}
              </Link>
              <button
                type="button"
                aria-label={`Remove ${f.title} from favorites`}
                onClick={() => removeFavorite(f.href)}
                className="absolute top-0 right-0 inline-flex size-5 items-center justify-center rounded text-yellow-400 opacity-0 transition-opacity group-hover/fav:opacity-100 hover:text-yellow-500 focus-visible:opacity-100 [&_svg]:size-3.5"
              >
                <Star className="fill-current" />
              </button>
            </div>
          ))}
    </div>
  )
}
