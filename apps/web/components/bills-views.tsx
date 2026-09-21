"use client"

import * as React from "react"
import { IconLayoutGrid, IconTable } from "@tabler/icons-react"

import { DocsHeader, NAV_BUTTON, type DocsLink } from "@/components/docs-header"
import { JurisdictionCards } from "@/components/jurisdiction-cards"
import { NationalSearchControls, NationalSearchResults, useNationalSearch } from "@/components/national-search"
import { StateTable } from "@/components/state-table"
import { JURISDICTIONS_TABLE } from "@/lib/jurisdictions"
import { Button } from "@govblock/ui/components/ny4/button"
import { cn } from "@govblock/ui/lib/utils"

// The root page's second section, two ways (Brendan, 2026-09-18): the
// jurisdictions as /bills's cards or as /state's table, switched by the two
// buttons where /bills keeps its arrows. The cards are the page's own; the
// table's rows are the counts frozen in lib/data/jurisdictions.json
// (2026-09-20; asked of /api/state-index until then). Under the
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
  const search = useNationalSearch()

  const choose = (next: View) => {
    search.dismiss()
    setView(next)
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
        ) : (
          <StateTable rows={JURISDICTIONS_TABLE} />
        )}
      </div>
    </>
  )
}
