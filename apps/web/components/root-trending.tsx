"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { TRENDING_PLACES } from "@/lib/trending"
import { FlagChip } from "@/components/policy/imagery"

// Under the root's search bar (Brendan, 2026-09-22), on the session cards'
// design: a soft panel four across and four down, and pressing a card puts its
// term in the bar above, scoped to its jurisdiction, and runs it.
//
// Each card is a subject and the one legislature arguing about it hardest —
// coal in West Virginia, wildfire in California, eminent domain in Texas. The
// eight nationwide terms the bar's drop-down carries could not fill sixteen
// cards: they are chosen for being everywhere, so every flag would have been
// the same. These are chosen the other way (lib/trending.ts).
//
// Pressing one writes `?q=<term>&places=<code>`. The bar reads `q` and the
// rail's filters read `places`, both already, so a card takes the same path a
// typed search and a set filter take rather than a path of its own — which is
// also the only thing on the root that says the two are one search.
//
// Once a search is running the cards go: the results are what the reader came
// for. Clearing the bar brings them back. Nothing here reads the database — the
// counts are frozen and the flags are ours.

export function RootTrending() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const running = (searchParams.get("q") ?? "").trim().length >= 2
  if (running) return null

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Trending</h2>
      <div className="rounded-3xl bg-muted/50 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRENDING_PLACES.map((item) => (
            <button
              key={`${item.term}-${item.place}`}
              type="button"
              onClick={() => router.push(`/?q=${encodeURIComponent(item.term)}&places=${item.place}`, { scroll: false })}
              className="flex h-full items-start gap-3 rounded-2xl border bg-background p-3 text-left transition-colors hover:bg-accent/50"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                <FlagChip state={item.place} width={28} />
              </span>
              <span className="flex min-w-0 flex-col">
                {/* The terms are stored as they are searched — lower case — and read here as they are spoken. */}
                <span className="text-sm font-semibold capitalize">{item.term}</span>
                <span className="text-sm text-muted-foreground">{stateName(item.place)}</span>
                <span className="text-sm tabular-nums">{fmtNumber(item.bills)} bills</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
