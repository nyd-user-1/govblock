"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { IconColumns2, IconLayoutGrid, IconList } from "@tabler/icons-react"
import { ArrowUpRight } from "lucide-react"

import { NAV_BUTTON } from "@/components/docs-header"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { Button } from "@govblock/ui/components/ny4/button"
import { cn } from "@govblock/ui/lib/utils"

// An index page's three views (Brendan, 2026-09-20): the same rows as cards,
// as the record list, or as Laws's columns of names — the lightweight one,
// two across, each cell's up-right arrow showing at its right end on hover.
// The buttons sit at the right, just above the header's rule, which is a slot
// the docs header leaves for them (data-slot="docs-views"); the list below
// owns the choice, so it portals them up. Each page opens on the view it
// always had, and a reader's choice is kept per page in this browser.
//
// The card is one standard: the star (and a feed's menu) at the top right, the
// up-right arrow rising into the bottom right on hover, two lines of title at
// most, one height.

export type IndexView = "cards" | "list" | "columns"

export type IndexEntry = {
  key: string
  href: string
  external?: boolean
  title: string
  /** The list row's muted tail after the title. */
  lead?: string | null
  /** The list row's second line, and the card's one line when it has no `count`. */
  meta?: (string | null | undefined | false)[]
  /** The list row's third line. */
  description?: string | null
  /** The card's bottom line: "196 Bills". */
  count?: string | null
  /** The emblem, sized for a list row and for a card. */
  avatar?: React.ReactNode
  cardMedia?: React.ReactNode
  feedHref?: string
  favoriteDetail?: string | null
}

const VIEWS: { view: IndexView; label: string; icon: React.ReactNode }[] = [
  { view: "cards", label: "Cards", icon: <IconLayoutGrid /> },
  { view: "list", label: "List", icon: <IconList /> },
  { view: "columns", label: "Columns", icon: <IconColumns2 /> },
]

/** The page's view and the buttons that change it, drawn into the header's slot. */
export function useIndexView(page: string, initial: IndexView) {
  const [view, setView] = React.useState<IndexView>(initial)
  const [slot, setSlot] = React.useState<Element | null>(null)
  React.useEffect(() => {
    setSlot(document.querySelector("[data-slot=docs-views]"))
    try {
      const kept = window.localStorage.getItem(`index-view:${page}`)
      if (kept === "cards" || kept === "list" || kept === "columns") setView(kept)
    } catch {}
  }, [page])
  const choose = (next: IndexView) => {
    setView(next)
    try {
      window.localStorage.setItem(`index-view:${page}`, next)
    } catch {}
  }
  const buttons = slot
    ? createPortal(
        VIEWS.map((v) => (
          <Button key={v.view} variant="secondary" size="icon" aria-pressed={view === v.view} onClick={() => choose(v.view)} className={cn(NAV_BUTTON, view !== v.view && "text-muted-foreground hover:text-foreground")}>
            {v.icon}
            <span className="sr-only">{v.label}</span>
          </Button>
        )),
        slot
      )
    : null
  return { view, buttons }
}

export function IndexEntries({ view, entries, className }: { view: IndexView; entries: IndexEntry[]; className?: string }) {
  if (view === "cards") {
    return (
      <ProjectGrid className={className}>
        {entries.map((e) => (
          <ProjectCard key={e.key} href={e.href} external={e.external} title={e.title} media={e.cardMedia ?? e.avatar} meta={e.count ?? (e.meta ?? []).filter(Boolean).join(" · ")} feedHref={e.feedHref} arrow star />
        ))}
      </ProjectGrid>
    )
  }
  if (view === "columns") {
    // Two across, cells at the top of their row (Brendan, 2026-09-20): a one-line name beside a two-line one does not drop to the middle.
    return (
      <div data-not-typeset="true" className={cn("grid grid-cols-1 items-start gap-4 sm:grid-cols-2 md:gap-x-8 lg:gap-x-16 lg:gap-y-6", className)}>
        {entries.map((e) => (
          <Link key={e.key} href={e.href} title={e.title} {...(e.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="group/cell -mx-2 flex items-start justify-between gap-2 self-start rounded-md px-2 py-1 text-lg font-medium underline-offset-4 transition-colors hover:bg-muted hover:underline md:text-base">
            <span className="min-w-0">{e.title}</span>
            <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100" />
          </Link>
        ))}
      </div>
    )
  }
  return (
    <RecordList className={className}>
      {entries.map((e) => (
        <RecordItem key={e.key} href={e.href} external={e.external} avatar={e.avatar} title={e.title} lead={e.lead} meta={e.meta ?? (e.count ? [e.count] : undefined)} description={e.description} favoriteDetail={e.favoriteDetail} />
      ))}
    </RecordList>
  )
}
