"use client"

import { Search } from "lucide-react"

import { openCommandMenu } from "@/components/command-menu"
import { Kbd } from "@govblock/ui/components/nova/kbd"

// The big search under the greeting (Brendan, 2026-09-07: Cloudflare's
// account home). Forty pixels tall (Brendan, 2026-09-07).
//
// The bar opens the site's ⌘K dialog (Brendan, 2026-09-21). It used to be a
// search of its own, dropping its results from itself and taking ⌘K ahead of
// the header, and the two drifted: the dialog learned the `/` and `@`
// addresses and the label column, the bar did not. One dialog now, from a
// click here or ⌘K anywhere.
//
// Under it, a few searches to try (Brendan, 2026-09-21), centred, one for
// each thing the search's tokens do (lib/search-query.ts): "/" narrows where
// or what kind, "@" who, and the rest is words. Each opens the dialog with the
// search typed. Every one of them answers with results (checked 2026-09-21).
const SUGGESTIONS: { term: string; gloss: string }[] = [
  { term: "artificial intelligence /ny", gloss: "Words, in one state" },
  { term: "/public safety /bills", gloss: "Bills only" },
  { term: "/809 /nj", gloss: "A bill number, in one state" },
  { term: "@martinez /ny", gloss: "A member, in one state" },
  { term: "/us/usc/t26", gloss: "A law, by its address" },
]

export function HomeSearch() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => openCommandMenu()}
        className="flex h-10 w-full cursor-text items-center gap-3 rounded-xl border bg-background px-3 text-[15px] shadow-xs ring-4 ring-muted/60 transition-[box-shadow,border-color] outline-hidden focus-visible:border-ring/60 focus-visible:ring-ring/15"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-left text-muted-foreground">Search</span>
        <span className="flex items-center gap-1">
          <Kbd className="border bg-background">⌘</Kbd>
          <Kbd className="border bg-background">K</Kbd>
        </span>
      </button>
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-2 p-0">
        {SUGGESTIONS.map((s) => (
          <li key={s.term} className="m-0 p-0">
            <button
              type="button"
              onClick={() => openCommandMenu(s.term)}
              className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="font-mono font-medium text-foreground">{s.term}</span>
              {s.gloss}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
