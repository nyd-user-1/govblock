"use client"

import * as React from "react"
import { IconLayoutGrid, IconTable } from "@tabler/icons-react"

import { DocsHeader, NAV_BUTTON, type DocsLink } from "@/components/docs-header"
import { JurisdictionCards } from "@/components/jurisdiction-cards"
import { NationalSearchControls, NationalSearchResults, useNationalSearch } from "@/components/national-search"
import { StateTable, StateTableSkeleton } from "@/components/state-table"
import type { IndexRow } from "@/lib/policy/state-index"
import { Button } from "@govblock/ui/components/ny4/button"
import { cn } from "@govblock/ui/lib/utils"

// The root page's second section, two ways (Brendan, 2026-09-18): the
// jurisdictions as /bills's cards or as /state's table, switched by the two
// buttons where /bills keeps its arrows. The cards are the page's own; the
// table's rows are asked for the first time a reader picks it, with its
// skeleton standing in meanwhile, and kept for every switch after. Under the
// counts, before the rule, the national search (components/national-search.tsx,
// Brendan, 2026-09-18): while a search stands its results take the body, and
// either view button puts the body back.

type View = "cards" | "table"

const VIEWS: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "cards", label: "Cards", icon: <IconLayoutGrid /> },
  { view: "table", label: "Table", icon: <IconTable /> },
]

export function BillsViews({ page, lead }: { page: { title: string; description: string; slug: string; next: DocsLink }; /** Drawn in the description's place: the root page streams the record's counts into it. */ lead?: React.ReactNode }) {
  const [view, setView] = React.useState<View>("cards")
  const [rows, setRows] = React.useState<IndexRow[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const search = useNationalSearch()
  const asking = React.useRef(false)

  const load = React.useCallback(() => {
    if (rows || asking.current) return
    asking.current = true
    setFailed(false)
    fetch("/api/state-index")
      .then((r) => (r.ok ? (r.json() as Promise<{ rows: IndexRow[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => setRows(body.rows))
      .catch(() => setFailed(true))
      .finally(() => {
        asking.current = false
      })
  }, [rows])

  const choose = (next: View) => {
    search.dismiss()
    setView(next)
    if (next === "table") load()
  }

  const nav = VIEWS.map((v) => (
    <Button
      key={v.view}
      variant="secondary"
      size="icon"
      aria-pressed={!search.asked && view === v.view}
      onClick={() => choose(v.view)}
      className={cn(NAV_BUTTON, (search.asked || view !== v.view) && "text-muted-foreground hover:text-foreground")}
    >
      {v.icon}
      <span className="sr-only">{v.label}</span>
    </Button>
  ))

  return (
    <>
      <DocsHeader
        {...page}
        lead={lead}
        nav={nav}
        below={<NationalSearchControls search={search} />}
      />
      <div className="typeset w-full">
        {search.asked ? (
          <NationalSearchResults search={search} />
        ) : view === "cards" ? (
          <JurisdictionCards base="/bills" />
        ) : rows ? (
          <StateTable rows={rows} />
        ) : failed ? (
          <p className="text-muted-foreground">
            The table did not load.{" "}
            <button type="button" onClick={load} className="underline underline-offset-4 hover:text-foreground">
              Try again
            </button>
          </p>
        ) : (
          <StateTableSkeleton />
        )}
      </div>
    </>
  )
}
