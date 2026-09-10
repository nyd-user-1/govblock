"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ChevronRightIcon } from "lucide-react"

import { lowerChamber, STATE_NAMES, stateName } from "@/lib/filters"
import { useAccount } from "@/lib/auth/use-account"
import { empty, grow, type Bounds } from "@/lib/map/bounds"
import { FIPS_TO_STATE } from "@/lib/map/fips"
import { accessTo } from "@/lib/map/access"
import { overlayFor, type OverlayId } from "@/lib/map/overlays"
import { representationAt, type Representation } from "@/lib/map/join"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useLocal } from "@/lib/policy/use-local"
import type {
  Acs,
  DistrictProps,
  Heat,
  Money,
  Party,
} from "@/components/map/districts-map"
import { sameDistrict } from "@/components/map/districts-map"
import { useStateDistricts } from "@/components/map/use-state-districts"
import { OverlayPicker } from "@/components/map/overlay-picker"
import { MapPanel } from "@/components/map/map-panel"
import { PathBar } from "@/components/create/path-bar"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"
import { BlockShell } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { ChamberRow } from "@/components/map/chamber-row"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@govblock/ui/components/ny4/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@govblock/ui/components/ny4/collapsible"
import { cn } from "@govblock/ui/lib/utils"

// /map (Brendan, 2026-09-09, a first pass): the 119th Congress's districts
// on the workspace shell — the rail lists the states, the stage is the map,
// the footer's hamburger opens the right-side panel on Solar's pattern. The
// boundaries and the ACS join are files under /geo, fetched once.
//
// The rail's chambers are the way into a state's own districts: clicking one
// draws that chamber and flies to the state. Which chambers a reader may
// draw is `lib/map/access.ts` — their own, once they are signed in.

const DistrictsMap = dynamic(
  () => import("@/components/map/districts-map").then((m) => m.DistrictsMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted/40" />,
  }
)

type BoundsMap = Record<string, Bounds>

/** One walk over the file: a box per state and a box per district. */
function boundsOf(fc: GeoJSON.FeatureCollection): {
  states: BoundsMap
  districts: BoundsMap
  byState: Record<string, DistrictProps[]>
} {
  const states: BoundsMap = {}
  const districts: BoundsMap = {}
  const byState: Record<string, DistrictProps[]> = {}
  for (const f of fc.features) {
    const p = f.properties as DistrictProps
    grow((states[p.state] ??= empty()), f.geometry)
    grow((districts[p.geoid] ??= empty()), f.geometry)
    ;(byState[p.state] ??= []).push(p)
  }
  for (const list of Object.values(byState))
    list.sort((a, b) => Number(a.district) - Number(b.district))
  return { states, districts, byState }
}

export function MapWorkspace() {
  const [panelOpen, setPanelOpen] = useLocal(
    "govblock:workspace:map:panel",
    true
  )
  const { signedIn } = useAccount()
  const { state: home } = useJurisdiction()
  const reader = React.useMemo(() => ({ signedIn, home }), [signedIn, home])

  const [overlays, setOverlays] = React.useState<Set<OverlayId>>(
    () => new Set<OverlayId>(["party"])
  )
  const toggleOverlay = (id: OverlayId) =>
    setOverlays((prev) => {
      const next = new Set(prev)
      // A drawn line can always be put out; switching one on answers the gate.
      if (next.has(id)) next.delete(id)
      else if (accessTo(id, reader).open) next.add(id)
      return next
    })
  const active = React.useMemo(() => [...overlays], [overlays])
  const chambers = useStateDistricts(active)

  const [acs, setAcs] = React.useState<Acs>({})
  const [party, setParty] = React.useState<Party>({})
  const [money, setMoney] = React.useState<Money>({})
  const [heat, setHeat] = React.useState<Heat>({ areas: [], districts: {} })
  const [heatArea, setHeatArea] = React.useState("")
  const [geo, setGeo] = React.useState<ReturnType<typeof boundsOf>>({
    states: {},
    districts: {},
    byState: {},
  })
  const [focusState, setFocusState] = React.useState<string | null>(null)
  // What the pointer is over, kept only to answer a click on the map: the
  // panel reads the held district, not this.
  const hoveredRef = React.useRef<DistrictProps | null>(null)
  const [selected, setSelected] = React.useState<DistrictProps | null>(null)
  const [flyTo, setFlyTo] = React.useState<Bounds | null>(null)
  const [rep, setRep] = React.useState<Representation | null>(null)
  const [joining, setJoining] = React.useState(false)
  const joinAt = React.useCallback(
    async (point: [number, number]) => {
      setJoining(true)
      try {
        const found = await representationAt(
          point,
          party,
          (id) => accessTo(id as OverlayId, reader).open
        )
        setRep(found)
        return found
      } catch {
        setRep(null)
        return null
      } finally {
        setJoining(false)
      }
    },
    [party, reader]
  )
  const searchAddress = async (address: string) => {
    setJoining(true)
    try {
      const r = (await (
        await fetch(`/api/map/geocode?q=${encodeURIComponent(address)}`)
      ).json()) as { match?: { lng: number; lat: number } | null }
      if (!r.match) {
        setRep(null)
        return
      }
      const { lng, lat } = r.match
      setFlyTo([lng - 0.15, lat - 0.1, lng + 0.15, lat + 0.1])
      setPanelOpen(true)
      const found = await joinAt([lng, lat])
      // The list answers with the district the point fell in, held.
      const geoid = found?.congress?.geoid
      const d = geoid
        ? Object.values(geo.byState)
            .flat()
            .find((x) => x.geoid === geoid)
        : null
      if (d) {
        setFocusState(d.state)
        setSelected(d)
      }
    } finally {
      setJoining(false)
    }
  }

  React.useEffect(() => {
    fetch("/geo/cd119-acs.json")
      .then((r) => r.json() as Promise<{ districts: Acs }>)
      .then((j) => setAcs(j.districts))
      .catch(() => setAcs({}))
    fetch("/geo/cd119-party.json")
      .then((r) => r.json() as Promise<{ districts: Party }>)
      .then((j) => setParty(j.districts))
      .catch(() => setParty({}))
    fetch("/geo/cd119.geojson")
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((fc) => setGeo(boundsOf(fc)))
      .catch(() => setGeo({ states: {}, districts: {}, byState: {} }))
  }, [])

  // A state district held while its chamber is switched off has nothing left
  // to point at, so it stops being held with the line — read, not stored, so
  // switching the chamber back on finds the district still there.
  const held = React.useMemo(() => {
    if (!selected?.chamber) return selected
    const drawn = chambers.some(
      (set) => set.chamber === selected.chamber && set.fips === selected.state
    )
    return drawn ? selected : null
  }, [chambers, selected])

  // A state's House delegation as one number: -1 every seat Republican, 1
  // every seat Democrat. Read off the party file the map already has.
  const delegation = React.useMemo(() => {
    const tally: Record<string, { d: number; r: number; n: number }> = {}
    for (const [geoid, seat] of Object.entries(party)) {
      const fips = geoid.slice(0, 2)
      const t = (tally[fips] ??= { d: 0, r: 0, n: 0 })
      t.n++
      if (seat.party === "D") t.d++
      else if (seat.party === "R") t.r++
    }
    return Object.fromEntries(
      Object.entries(tally).map(([fips, t]) => [
        fips,
        t.n ? (t.d - t.r) / t.n : 0,
      ])
    )
  }, [party])

  // Money and heat are a reading's file, not the map's: 131 KB that a reader
  // who never opens those overlays should not pay for. Fetched the first time
  // one is switched on, and kept.
  const wantsMoney = overlays.has("money")
  const wantsHeat = overlays.has("heat")
  React.useEffect(() => {
    if (!wantsMoney || Object.keys(money).length) return
    fetch("/geo/cd119-money.json")
      .then((r) => r.json() as Promise<{ districts: Money }>)
      .then((j) => setMoney(j.districts))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsMoney])
  React.useEffect(() => {
    if (!wantsHeat || heat.areas.length) return
    fetch("/geo/cd119-heat.json")
      .then((r) => r.json() as Promise<Heat>)
      .then((j) => {
        setHeat(j)
        setHeatArea((a) => a || j.areas[0] || "")
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsHeat])

  const states = React.useMemo(
    () =>
      Object.keys(geo.states)
        .filter((f) => FIPS_TO_STATE[f] && FIPS_TO_STATE[f] in STATE_NAMES)
        .sort((a, b) =>
          stateName(FIPS_TO_STATE[a]).localeCompare(stateName(FIPS_TO_STATE[b]))
        ),
    [geo]
  )
  const COUNTRY: Bounds = [-125, 24.5, -66.9, 49.4]
  const flyToState = (fips: string | null) => {
    setSelected(null)
    if (!fips || !geo.states[fips]) {
      setFocusState(null)
      setFlyTo([...COUNTRY] as Bounds)
      return
    }
    setFocusState(fips)
    setFlyTo([...geo.states[fips]] as Bounds)
  }
  /** Where a district is: the congressional file, or the chamber's own. */
  const boxOf = (d: DistrictProps) =>
    d.chamber
      ? chambers.find(
          (set) => set.chamber === d.chamber && set.fips === d.state
        )?.bounds[d.geoid]
      : geo.districts[d.geoid]
  const selectDistrict = (d: DistrictProps | null) => {
    if (!d) {
      // Letting go of a district falls back to its state.
      const state = held?.state ?? focusState
      setSelected(null)
      if (state && geo.states[state]) setFlyTo([...geo.states[state]] as Bounds)
      return
    }
    setFocusState(d.state)
    setSelected(d)
    const box = boxOf(d)
    if (box) setFlyTo([...box] as Bounds)
  }

  // The chambers a state seats: a Senate and a House or Assembly, the
  // District's Council, Nebraska's single Legislature.
  const chambersOf = (code: string) =>
    code === "DC"
      ? ["Council"]
      : code === "NE"
        ? ["Legislature"]
        : ["Senate", lowerChamber(code)]

  /** Draw this chamber and go there — or, if it is already drawn, stop drawing it. */
  const openChamber = (fips: string, code: string, chamber: string) => {
    const o = overlayFor(code, chamber)
    if (!o || !accessTo(o.id, reader).open) return
    const drawn = overlays.has(o.id)
    toggleOverlay(o.id)
    if (!drawn) flyToState(fips)
  }

  const rail = (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>States</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {states.map((fips) => {
              const code = FIPS_TO_STATE[fips]
              return (
                <Collapsible key={fips} className="group/state">
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => flyToState(fips)}>
                      <FlagChip state={code} width={20} />
                      <span className="flex-1 truncate">{stateName(code)}</span>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Chambers of ${stateName(code)}`}
                        className="absolute top-1.5 right-1 flex size-5 items-center justify-center rounded-md text-muted-foreground transition-transform group-data-[state=open]/state:rotate-90 hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRightIcon className="size-4" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {chambersOf(code).map((chamber) => (
                          <SidebarMenuSubItem key={chamber}>
                            <ChamberRow
                              code={code}
                              chamber={chamber}
                              active={overlays}
                              reader={reader}
                              onOpen={() => openChamber(fips, code, chamber)}
                            >
                              <ChamberSeal
                                state={code}
                                chamber={chamber}
                                size={20}
                              />
                            </ChamberRow>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )

  const footer = (
    <WorkspaceFooter
      mode="map"
      panelOpen={panelOpen}
      onTogglePanel={() => setPanelOpen((open) => !open)}
    />
  )

  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--gap:--spacing(4)] [--panel-width:423px] md:[--gap:--spacing(6)]"
      )}
    >
      <div
        data-slot="designer"
        className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row"
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell
              defaultOpen={false}
              rail={rail}
              title={
                <PathBar crumbs={[{ label: "Map" }]} folder onGo={() => {}} />
              }
              actions={
                <OverlayPicker
                  active={overlays}
                  onToggle={toggleOverlay}
                  signedIn={signedIn}
                  home={home}
                />
              }
              footer={footer}
              contentClassName="overflow-hidden"
            >
              <div className="h-full w-full">
                <DistrictsMap
                  overlays={overlays}
                  chambers={chambers}
                  acs={acs}
                  party={party}
                  money={money}
                  heat={heat}
                  heatArea={heatArea}
                  onHeatArea={setHeatArea}
                  delegation={delegation}
                  selected={held}
                  focusState={focusState}
                  onSelect={(d) => {
                    setSelected(d)
                    if (d) {
                      setFocusState(d.state)
                      // The panel answers a click on the map, not the page load.
                      setPanelOpen(true)
                    }
                  }}
                  onPoint={(point) => void joinAt(point)}
                  onHover={(p) => {
                    hoveredRef.current = p
                    if (sameDistrict(p, held)) setSelected(p)
                  }}
                  flyTo={flyTo}
                />
              </div>
            </BlockShell>
          </div>
        </div>
        <MapPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          acs={acs}
          party={party}
          selected={held}
          states={states}
          chambers={chambers}
          districtsOf={(fips) => geo.byState[fips] ?? []}
          onSelectDistrict={selectDistrict}
          rep={rep}
          joining={joining}
          onSearch={searchAddress}
        />
      </div>
    </div>
  )
}
