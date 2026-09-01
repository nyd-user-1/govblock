"use client"

import * as React from "react"

import type { StateCount } from "@/lib/policy/states"
import { Customizer } from "@/components/create/customizer"
import type { Bill, Committee, Member } from "@/components/create/entity-card"
import { DEFAULT_DESIGN, DESIGN_OPTIONS, EMPTY_FILTERS, type Design, type Filters } from "@/components/create/fields"
import { Preview, type Entity } from "@/components/create/preview"

// /create's state: which panel, which filters, which design, which card. The
// data comes from the server (the page); everything here is in the browser.
export function Designer({ bills, members, committees, states }: { bills: (Bill & { state: string })[]; members: Member[]; committees: Committee[]; states: StateCount[] }) {
  const [mode, setMode] = React.useState<"state" | "design">("state")
  const [entity, setEntityRaw] = React.useState<Entity>("bill")
  const [loading, setLoading] = React.useState(false)
  const [filters, setFiltersRaw] = React.useState<Filters>(EMPTY_FILTERS)
  const [design, setDesignRaw] = React.useState<Design>(DEFAULT_DESIGN)
  const setFilters = (patch: Partial<Filters>) => setFiltersRaw((f) => ({ ...f, ...patch }))
  const setDesign = (patch: Partial<Design>) => setDesignRaw((d) => ({ ...d, ...patch }))

  // A beat of skeleton between kinds, so the switch reads as a load.
  const setEntity = (next: Entity) => {
    if (next === entity) return
    setLoading(true)
    setEntityRaw(next)
    window.setTimeout(() => setLoading(false), 350)
  }
  const shuffle = () => {
    const pick = <K extends keyof Design>(k: K) => DESIGN_OPTIONS[k][Math.floor(Math.random() * DESIGN_OPTIONS[k].length)].value
    setDesignRaw({ style: pick("style"), baseColor: pick("baseColor"), theme: pick("theme"), chartColor: pick("chartColor"), fontHeading: pick("fontHeading"), font: pick("font"), iconLibrary: pick("iconLibrary"), radius: pick("radius") })
  }
  const reset = () => {
    setDesignRaw(DEFAULT_DESIGN)
    setFiltersRaw(EMPTY_FILTERS)
  }

  const inState = React.useMemo(() => bills.filter((b) => b.state === filters.state), [bills, filters.state])
  const shownBills = React.useMemo(
    () =>
      inState.filter(
        (b) =>
          (!filters.chamber || b.body === filters.chamber) &&
          (!filters.committee || b.committee === filters.committee) &&
          (!filters.party || b.sponsor_party === filters.party) &&
          (!filters.status || b.status_desc === filters.status) &&
          (!filters.member || b.sponsor === filters.member)
      ),
    [inState, filters]
  )
  const stateMembers = filters.state === "US" ? members : []
  const stateCommittees = filters.state === "US" ? committees : []
  const shownMembers = stateMembers.filter((m) => (!filters.chamber || m.chamber === filters.chamber) && (!filters.party || m.party === filters.party))
  const shownCommittees = stateCommittees.filter((c) => !filters.chamber || c.chamber === filters.chamber)

  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort()
  const chambers = uniq([...inState.map((b) => b.body), ...stateMembers.map((m) => m.chamber)])
  const committeeNames = uniq(inState.map((b) => b.committee))
  const memberNames = uniq(inState.map((b) => b.sponsor))
  const statuses = uniq(inState.map((b) => b.status_desc))

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        <Preview entity={entity} setEntity={setEntity} state={filters.state} bills={shownBills} members={shownMembers} committees={shownCommittees} loading={loading} />
        <Customizer
          mode={mode}
          setMode={setMode}
          filters={filters}
          setFilters={setFilters}
          design={design}
          setDesign={setDesign}
          onShuffle={shuffle}
          onReset={reset}
          states={states}
          chambers={chambers}
          committees={committeeNames}
          members={memberNames}
          statuses={statuses}
          entity={entity}
        />
      </div>
    </div>
  )
}
