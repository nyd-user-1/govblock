"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon, CopyIcon, SearchIcon, XIcon } from "lucide-react"

import { TagItem } from "@/components/tags/follow"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

import { cn } from "@govblock/ui/lib/utils"
import { LETTERS, letterId, letterOf } from "@/lib/tags/letters"

// /tags as daily.dev lays its tags out (Brendan, 2026-09-18): a search over
// every tag, the recommended few under it, a letter bar, the trending, popular
// and recently added columns, then every tag A to Z. A letter or a search
// narrows the A-to-Z list and folds the three columns away.

export type TagRow = { slug: string; name: string; total: number }

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

function Column({ title, rows }: { title: string; rows: TagRow[] }) {
  const [more, setMore] = React.useState(false)
  const shown = more ? rows : rows.slice(0, 8)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <ul className="flex flex-col gap-0.5">
        {shown.map((row) => (
          <li key={row.slug}>
            <TagItem slug={row.slug} count={compact.format(row.total)} />
          </li>
        ))}
      </ul>
      {rows.length > 8 && (
        <button type="button" onClick={() => setMore((m) => !m)} className="self-start text-sm text-muted-foreground hover:text-foreground">
          {more ? "Less" : "More"}
        </button>
      )}
    </div>
  )
}


/** The letter copies a link to its own section; the copy icon shows on hover. */
function LetterHeading({ letter }: { letter: string }) {
  const { copyToClipboard, isCopied } = useCopyToClipboard()
  return (
    <h2 className="text-2xl font-semibold">
      <button
        type="button"
        aria-label={`Copy a link to ${letter}`}
        onClick={() => copyToClipboard(`${window.location.origin}/tags#${letterId(letter)}`)}
        className="group/letter flex items-center gap-2"
      >
        {letter}
        {isCopied ? <CheckIcon className="size-4 text-emerald-600" /> : <CopyIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/letter:opacity-100" />}
      </button>
    </h2>
  )
}

export function TagsExplorer({ tags, trending, popular, recent, recommended }: { tags: TagRow[]; trending: TagRow[]; popular: TagRow[]; recent: TagRow[]; recommended: TagRow[] }) {
  const [query, setQuery] = React.useState("")
  const [letter, setLetter] = React.useState<string | null>(null)

  const present = React.useMemo(() => new Set(tags.map((t) => letterOf(t.name))), [tags])
  const q = query.trim().toLowerCase()
  const filtered = React.useMemo(
    () => tags.filter((t) => (!letter || letterOf(t.name) === letter) && (!q || t.name.toLowerCase().includes(q) || t.slug.includes(q.replace(/\s+/g, "-")))),
    [tags, letter, q],
  )
  const groups = React.useMemo(() => {
    const by = new Map<string, TagRow[]>()
    for (const t of filtered) {
      const l = letterOf(t.name)
      by.set(l, [...(by.get(l) ?? []), t])
    }
    return LETTERS.filter((l) => by.has(l)).map((l) => ({ letter: l, rows: by.get(l)! }))
  }, [filtered])
  const narrowed = !!q || !!letter

  return (
    <div className="not-typeset flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <label className="flex h-11 items-center gap-3 rounded-xl border bg-background px-4 focus-within:border-foreground/30">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all tags" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {query && (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <XIcon className="size-4" />
            </button>
          )}
        </label>
        {recommended.length > 0 && (
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">Recommended:</span>
            {recommended.map((t) => (
              <Link key={t.slug} href={`/tags/${t.slug}`} className="text-foreground no-underline hover:underline">
                {t.slug}
              </Link>
            ))}
          </p>
        )}
      </div>

      <nav aria-label="Letters" className="flex flex-wrap justify-center gap-1">
        {[null, ...LETTERS].map((l) => {
          const on = letter === l
          const empty = l !== null && !present.has(l)
          return (
            <button
              key={l ?? "all"}
              type="button"
              disabled={empty}
              onClick={() => setLetter(l)}
              className={cn("min-w-8 rounded-md px-2 py-1 text-sm font-medium tabular-nums transition-colors", on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground", empty && "pointer-events-none opacity-35")}
            >
              {l ?? "ALL"}
            </button>
          )
        })}
      </nav>

      <hr className="border-border" />

      {!narrowed && (
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-5">
          <Column title="Trending tags" rows={trending} />
          <Column title="Popular tags" rows={popular} />
          <Column title="Recently added tags" rows={recent} />
        </div>
      )}

      <div className="flex flex-col gap-8">
        {groups.map((g) => (
          <section key={g.letter} id={letterId(g.letter)} className="flex scroll-mt-24 flex-col gap-3">
            <div className="flex items-center gap-4">
              <LetterHeading letter={g.letter} />
              <span className="h-px flex-1 bg-border" />
            </div>
            <ul className="columns-2 gap-5 sm:columns-3">
              {g.rows.map((t) => (
                <li key={t.slug} className="break-inside-avoid">
                  <TagItem slug={t.slug} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && <p className="text-sm text-muted-foreground">No tag matches &ldquo;{query}&rdquo;.</p>}
      </div>
    </div>
  )
}
