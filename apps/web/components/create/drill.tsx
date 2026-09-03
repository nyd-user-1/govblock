"use client"

import * as React from "react"
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"

import { designDiff, type Design } from "@/lib/create/preset"
import { stateName } from "@/lib/filters"
import { useSessionTitle, type Scope } from "@/lib/policy/scope"
import { MemberRecord } from "@/components/create/member-record"
import type { Drill } from "@/components/create/entity-card"
import { Fab, FabButton } from "@/components/create/fab"
import { Button } from "@govblock/ui/components/ny4/button"

// The drill-down: a card's button opens the thing in place of the grid, with
// a back arrow at the top left to return. Brendan, 2026-09-03: "neither button
// navigates away, both buttons open in place as a drill down, so to speak,
// with a back arrow."
//
// The record pages — a bill, a member, a committee's bills, the calendar —
// are server-rendered from the database, so they open in a frame, the way the
// typeset preview and the block viewer already do. The site's header and
// footer hide themselves inside a frame (the root layout marks an embedded
// document before first paint), so what shows is the page and nothing else.
// The member's Record is the one view built here: the dashboard shape over
// the bills they sponsored and the votes they cast.

const today = () => new Date().toISOString().slice(0, 10)

function query(pairs: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(pairs)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
  const text = params.toString()
  return text ? `?${text}` : ""
}

export function drillHref(drill: Drill, scope: Scope, design: Design): string | null {
  const { state, session } = scope
  const sessionParam = scope.filters.session ? session : undefined
  switch (`${drill.kind}:${drill.view}`) {
    case "bill:record":
      return `/docs/bills/${drill.id}${query({ state })}`
    case "bill:typeset":
      return `/preview/typeset/docs${query({ state, session: sessionParam, bill: drill.id, ...designDiff(design) })}`
    case "committee:record":
      return `/docs/bills${query({ state, session: sessionParam, committee: drill.id })}`
    case "committee:calendar":
      return `/calendar/month/${today()}${query({ state, session: sessionParam, committee: drill.id })}`
    case "member:record":
      return `/docs/directory/${drill.id}${query({ state })}`
    default:
      return null
  }
}

const VIEW_LABEL: Record<string, string> = { record: "Record", typeset: "Typeset", calendar: "Calendar", dashboard: "Record" }

export function DrillView({ drill, scope, design, onBack, onSwitch }: { drill: Drill; scope: Scope; design: Design; onBack: () => void; onSwitch: (view: string) => void }) {
  const href = drillHref(drill, scope, design)
  const sessionTitle = useSessionTitle(scope.state, scope.session)
  const views = drill.kind === "bill" ? ["record", "typeset"] : drill.kind === "committee" ? ["record", "calendar"] : ["record", "dashboard"]
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon-sm" aria-label="Back to the cards" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <span className="truncate text-sm font-medium">{drill.label}</span>
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          {/* "119th Congress" names the state and the session at once; a state's session title does not, so the state leads it. */}
          {/Congress/i.test(sessionTitle) ? sessionTitle : [stateName(scope.state), sessionTitle].filter(Boolean).join(" · ")}
        </span>
        {href && (
          <Button variant="ghost" size="sm" className="ml-auto" asChild>
            <a href={href} target="_blank" rel="noreferrer">
              Open in new tab <ExternalLinkIcon className="size-3.5" />
            </a>
          </Button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {drill.kind === "member" && drill.view === "dashboard" ? (
          <MemberRecord id={Number(drill.id)} scope={scope} label={drill.label} />
        ) : href ? (
          <iframe key={href} src={href} title={`${drill.label} · ${VIEW_LABEL[drill.view] ?? drill.view}`} className="size-full bg-background" />
        ) : (
          <p className="p-8 text-sm text-muted-foreground">No view for that.</p>
        )}
      </div>
      <Fab className="absolute bottom-3 left-1/2 -translate-x-1/2">
        {views.map((view) => (
          <FabButton key={view} active={drill.view === view} onClick={() => onSwitch(view)}>
            {drill.kind === "bill" && view === "record" ? "Bill" : drill.kind === "committee" && view === "record" ? "Bills" : drill.kind === "member" && view === "record" ? "Member" : VIEW_LABEL[view]}
          </FabButton>
        ))}
      </Fab>
    </div>
  )
}
