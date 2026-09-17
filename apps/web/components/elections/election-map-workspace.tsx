"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ChevronRightIcon, XIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/button"
import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/toggle-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

import { PathBar } from "@/components/create/path-bar"
import { Dot, Hemicycle, SEAT_COLOR } from "@/components/elections/hemicycle"
import type { ColorBy } from "@/components/elections/election-map"
import type { TopTwoYear } from "@/components/elections/top-two"
import { useTip } from "@/components/elections/tip"
import { BlockShell } from "@/components/policy/block-shell"
import { FlagChip } from "@/components/policy/imagery"
import { person } from "@/lib/elections/names"
import { PARTY_NAME, chamberName, control, flipped, norm, primaryIndex, seatName, seatShort, seatsFrom, simulate, subjectName, tally, type PrimaryRace, type Results, type Rule, type SimSeat } from "@/lib/elections/seats"
import { stateName } from "@/lib/filters"
import { NO_DATA, PARTY_COLORS, RAMP } from "@/lib/map/palette"

// /simulator/map (Brendan, 2026-09-16): the /map console with the
// simulation in it. The rail picks the election and the rule; the map is
// the stage; the panel holds the seat ring, one sentence on what the rule
// changed, and any district clicked. Only the views scripts/elections/
// map.mjs verified are offered — a House cycle on its own Congress's
// districts, a state chamber in a year whose boundaries provably did not
// move across the election — so no result is ever drawn on a boundary it
// was not run on. A chamber with no verified year says why instead.

const ElectionMap = dynamic(() => import("@/components/elections/election-map").then((m) => m.ElectionMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted/40" />,
})

export type HouseView = { year: number; congress: number; shapes: string; results: string; states: string[] }
export type ChamberView = { year: number; state: string; office: "STATE HOUSE" | "STATE SENATE"; shapes: string; results: string }
export type LeftOut = { year: number; state: string; office: string; why: string }
type View = { kind: "house"; view: HouseView } | { kind: "chamber"; view: ChamberView }
type ChamberRow = { year: number; state: string; office: string; dem_vote_share: number | null; dem_seats: number }
type RuleKind = "held" | "swing" | "matched" | "top2" | "top4"

const CHAMBERS_URL = "https://govblock-geo-638175140432.s3.amazonaws.com/elections/chambers.json"
const PRESSED = "aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
const number = new Intl.NumberFormat("en-US")
const stOf = (v: View) => (v.kind === "house" ? "US" : v.view.state)
const officeOf = (v: View) => (v.kind === "house" ? "US HOUSE" : v.view.office)
const P = (p: "D" | "R") => <b style={{ color: PARTY_COLORS[p] }}>{PARTY_NAME[p]}</b>
const Score = ({ t }: { t: Record<string, number> }) => (
  <b className="tabular-nums">
    {t.D > t.R ? (
      <>
        <span style={{ color: PARTY_COLORS.D }}>{t.D}</span>–<span style={{ color: PARTY_COLORS.R }}>{t.R}</span>
      </>
    ) : (
      <>
        <span style={{ color: PARTY_COLORS.R }}>{t.R}</span>–<span style={{ color: PARTY_COLORS.D }}>{t.D}</span>
      </>
    )}
  </b>
)

function Sentence({ short, seats, rule, row, hasPrimaries }: { short: string; seats: SimSeat[]; rule: Rule; row: ChamberRow | null; hasPrimaries: boolean }) {
  const n = seats.length
  const t = tally(seats)
  const base = tally(seats.map((s) => ({ ...s, now: s.party })))
  const c = control(t, n)
  const cb = control(base, n)
  const fl = flipped(seats)
  const settled = seats.filter((s) => s.tier !== "live").length
  const holds = cb === "D" || cb === "R" ? <>{P(cb)} hold</> : <>No party holds</>
  if (rule.kind === "swing" && rule.swing) {
    const to = rule.swing < 0 ? "D" : "R"
    return (
      <>
        A {Math.abs(rule.swing)}-point swing to {P(to)} flips <b>{fl.length} seat{fl.length === 1 ? "" : "s"}</b>
        {c && c !== cb ? ` and control of the ${short}` : c === cb ? " but not control" : ""}: <Score t={t} />. The other {n - fl.length} were out of reach.
      </>
    )
  }
  if (rule.kind === "matched")
    return row?.dem_vote_share != null ? (
      <>
        {row.dem_vote_share}% of the vote would give {P("D")} <b>{t.D} of {n}</b> seats. The districts gave them {base.D}.
      </>
    ) : (
      <>The chamber&rsquo;s vote totals are still loading.</>
    )
  if (rule.kind === "top2" || rule.kind === "top4") {
    if (!hasPrimaries) return <>This chamber&rsquo;s primaries are not on file, so an open primary cannot be run on it yet.</>
    const moved = seats.filter((s) => s.moved).length
    return (
      <>
        One open primary, {rule.kind === "top2" ? "top two" : "four"} advancing, moves <b>{moved} of {settled}</b> settled seats to November for all voters to decide.
      </>
    )
  }
  const nobody = seats.filter((s) => s.tier === "nobody").length
  const close = seats.filter((s) => s.share != null && Math.abs(s.share - 50) * 2 < 5).length
  return (
    <>
      {holds} the {short} <Score t={base} />. <span className="tabular-nums">{nobody}</span> seats had no opponent, <span className="tabular-nums">{close}</span> were decided by under 5 points.
    </>
  )
}

export function ElectionMapWorkspace({ house, chambers, leftOut, years }: { house: HouseView[]; chambers: ChamberView[]; leftOut: LeftOut[]; years: TopTwoYear[] }) {
  const [current, setCurrent] = React.useState<View>({ kind: "house", view: house.find((h) => h.year === 2024) ?? house[0] })
  const [results, setResults] = React.useState<Results | null>(null)
  const [prim, setPrim] = React.useState<Record<string, PrimaryRace> | null>(null)
  const [rows, setRows] = React.useState<ChamberRow[] | null>(null)
  const [ruleKind, setRuleKind] = React.useState<RuleKind>("held")
  const [swing, setSwing] = React.useState(0)
  const [colorBy, setColorBy] = React.useState<ColorBy>("party")
  const [selected, setSelected] = React.useState<string | null>(null)
  const tip = useTip()

  const st = stOf(current)
  const office = officeOf(current)
  const primariesUrl = years.find((y) => y.year === current.view.year && y.offices.includes(office))?.url

  React.useEffect(() => {
    let live = true
    setResults(null)
    setPrim(null)
    setSelected(null)
    fetch(current.view.results)
      .then((r) => r.json() as Promise<Results>)
      .then((body) => live && setResults(body))
      .catch(() => live && setResults({}))
    if (primariesUrl)
      fetch(primariesUrl)
        .then((r) => r.json() as Promise<{ races: PrimaryRace[] }>)
        .then((body) => live && setPrim(primaryIndex(body.races.filter((r) => r.office === office && (st === "US" || r.state === st)), st)))
        .catch(() => {})
    return () => {
      live = false
    }
  }, [current, primariesUrl, office, st])

  // The chamber's vote totals, for seats matched to votes: one file, read the first time the rule is picked.
  React.useEffect(() => {
    if (ruleKind !== "matched" || rows) return
    fetch(CHAMBERS_URL)
      .then((r) => r.json() as Promise<{ rows: ChamberRow[] }>)
      .then((b) => setRows(b.rows))
      .catch(() => setRows([]))
  }, [ruleKind, rows])

  const row = React.useMemo(() => rows?.find((r) => r.state === st && r.office === office && r.year === current.view.year) ?? null, [rows, st, office, current])
  const rule: Rule = { kind: ruleKind, swing: ruleKind === "swing" ? swing : 0 }
  const base = React.useMemo(() => (results ? seatsFrom(results) : []), [results])
  const seats = React.useMemo(() => simulate(base, rule, row, prim), [base, rule, row, prim])
  const t = tally(seats)
  const changed = seats.filter((s) => s.now !== s.party || s.moved)
  const sel = selected ? seats.filter((s) => s.key === selected) : []
  const label = current.kind === "house" ? `U.S. House, ${current.view.year}` : subjectName(current.view.state, current.view.office, current.view.year)
  const short = current.kind === "house" ? "House" : chamberName(current.view.state, current.view.office)
  const isCurrent = (v: View) => v.kind === current.kind && v.view.shapes === current.view.shapes
  const states = React.useMemo(() => [...new Set(chambers.map((c) => c.state).concat(leftOut.map((l) => l.state)))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [chambers, leftOut])

  const rail = (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>U.S. House</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {house.map((h) => (
              <SidebarMenuItem key={h.year}>
                <SidebarMenuButton isActive={isCurrent({ kind: "house", view: h })} onClick={() => setCurrent({ kind: "house", view: h })}>
                  <span className="flex-1">{h.year}</span>
                  <span className="text-xs text-muted-foreground">{h.congress}th Congress</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>State legislatures</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {states.map((code) => {
              const offices = (["STATE SENATE", "STATE HOUSE"] as const).filter((o) => code !== "NE" || o === "STATE SENATE")
              return (
                <Collapsible key={code} className="group/state">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <FlagChip state={code} width={20} />
                        <span className="flex-1 truncate">{stateName(code)}</span>
                        <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]/state:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {offices.map((o) => {
                          const views = chambers.filter((c) => c.state === code && c.office === o).sort((a, b) => b.year - a.year)
                          const why = leftOut.filter((l) => l.state === code && l.office === o).sort((a, b) => b.year - a.year)[0]
                          return (
                            <SidebarMenuSubItem key={o} className="flex flex-col gap-1 py-1">
                              <span className="px-2 text-xs font-medium">{chamberName(code, o)}</span>
                              {views.length ? (
                                <div className="flex flex-wrap gap-1 px-2">
                                  {views.map((v) => (
                                    <button key={v.year} type="button" onClick={() => setCurrent({ kind: "chamber", view: v })} aria-pressed={isCurrent({ kind: "chamber", view: v })} className={cn("rounded-md border px-1.5 py-0.5 text-xs tabular-nums hover:bg-muted", PRESSED)}>
                                      {v.year}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="px-2 text-xs text-muted-foreground" title={why?.why}>
                                  Not drawn{why ? `: ${why.why.replace(/^boundaries: /, "")}` : ""}
                                </span>
                              )}
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Rule</SidebarGroupLabel>
        <SidebarGroupContent>
          <ToggleGroup value={[ruleKind]} onValueChange={(next) => next?.[0] && setRuleKind(next[0] as RuleKind)} variant="outline" spacing={1} className="flex-col items-stretch px-2">
            {(
              [
                ["held", "As elected"],
                ["swing", "Swing the vote"],
                ["matched", "Seats matched to votes"],
                ["top2", "Open primary, top two"],
                ["top4", "Open primary, top four"],
              ] as const
            ).map(([k, l]) => (
              <ToggleGroupItem key={k} value={k} className={cn("justify-start", PRESSED)} disabled={(k === "top2" || k === "top4") && !primariesUrl}>
                {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )

  const ringLegend = ruleKind === "swing" ? "flips with the swing" : ruleKind === "matched" ? "changes hands" : "moved to November by the open primary"
  const hoverSeat = (key: string | null, e?: { originalEvent: MouseEvent }) => {
    const s = key ? seats.find((x) => x.key === key) : null
    if (!s || !e) return tip.hide()
    tip.show(
      <>
        <b>{seatName(st, s)}</b>
        <br />
        {s.tier === "nobody" ? `${s.winner} · no opponent` : `${s.winner} (${s.party}) by ${s.margin} pts`}
        {s.now !== s.party && <span className="text-background/70"> · flips to {PARTY_NAME[s.now]}</span>}
        {s.moved && s.matchup && <span className="text-background/70"> · November: {s.matchup.join(" v. ")}</span>}
      </>,
      e.originalEvent
    )
  }

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--gap:--spacing(4)] [--panel-width:400px] md:[--gap:--spacing(6)]">
      <div className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell
              defaultOpen
              rail={rail}
              title={<PathBar crumbs={[{ label: "Simulator", href: "/simulator" }, { label }]} folder onGo={() => {}} />}
              actions={
                <ToggleGroup value={[colorBy]} onValueChange={(next) => next?.[0] && setColorBy(next[0] as ColorBy)} variant="outline" spacing={1}>
                  <ToggleGroupItem value="party" className={PRESSED}>
                    Party
                  </ToggleGroupItem>
                  <ToggleGroupItem value="margin" className={PRESSED}>
                    Margin
                  </ToggleGroupItem>
                </ToggleGroup>
              }
              contentClassName="overflow-hidden"
            >
              <div className="relative h-full w-full">
                <ElectionMap shapes={current.view.shapes} seats={results ? seats : null} colorBy={colorBy} frame={current.kind === "house" ? "conus" : "fit"} selected={selected} onSelect={setSelected} onHover={hoverSeat} />
                <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-background/95 px-3 py-1.5 text-[13px] font-medium shadow-sm ring-1 ring-foreground/10">
                  {label} · {t.R}–{t.D}
                </div>
                <div className="pointer-events-none absolute top-12 left-3 flex flex-col gap-1 rounded-lg bg-background/95 px-2.5 py-2 text-xs shadow-sm ring-1 ring-foreground/10">
                  {(colorBy === "party"
                    ? [
                        ["Democratic", PARTY_COLORS.D],
                        ["Republican", PARTY_COLORS.R],
                        ["Other", PARTY_COLORS.I],
                        ["No race this year", NO_DATA],
                      ]
                    : ["Under 5 points", "5 to 10", "10 to 20", "20 or more", "No opponent"].map((l, i) => [l, RAMP[i]]).concat([["No race this year", NO_DATA]])
                  ).map(([l, c]) => (
                    <span key={l} className="flex items-center gap-1.5">
                      <span className="size-3 rounded-sm" style={{ background: c }} />
                      {l}
                    </span>
                  ))}
                  {changed.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-sm border-2 border-foreground" />
                      {ringLegend}
                    </span>
                  )}
                </div>
                {ruleKind === "swing" && (
                  <div className="absolute bottom-11 left-1/2 w-[min(600px,calc(100%-200px))] -translate-x-1/2 rounded-2xl bg-background/95 px-4 py-2.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur">
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1.5 left-1/2 h-4 w-px -translate-x-px bg-foreground" />
                      <input
                        type="range"
                        min={-10}
                        max={10}
                        step={0.5}
                        value={swing}
                        onChange={(e) => setSwing(Number(e.target.value))}
                        aria-label="Swing, points"
                        className="h-7 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,#2563eb_0,#dbeafe_50%,#fee2e2_50%,#dc2626_100%)] [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:bg-background"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <b style={{ color: PARTY_COLORS.D }}>← to Democrats</b>
                      <span className="tabular-nums">{swing === 0 ? "no swing" : `${Math.abs(swing)} point${Math.abs(swing) === 1 ? "" : "s"} to ${swing < 0 ? "Democrats" : "Republicans"} · ${flipped(seats).length} seats`}</span>
                      <b style={{ color: PARTY_COLORS.R }}>to Republicans →</b>
                    </div>
                  </div>
                )}
              </div>
            </BlockShell>
          </div>
        </div>

        <div className="flex min-h-0 shrink-0 flex-col overflow-hidden md:w-(--panel-width)">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card ring ring-foreground/10">
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4 text-sm">
              <h1 className="text-xl leading-tight font-normal tracking-tight text-pretty">{results ? <Sentence short={short} seats={seats} rule={rule} row={row} hasPrimaries={Boolean(prim && Object.keys(prim).length)} /> : "Reading every district…"}</h1>
              {results && (
                <div>
                  <Hemicycle
                    seats={seats}
                    size={360}
                    selected={sel[0]?.id ?? null}
                    onHover={(s, e) => (s && e ? tip.show(<><b>{seatName(st, s)}</b><br />{s.tier === "nobody" ? `${s.winner} · no opponent` : `${s.winner} (${s.party}) by ${s.margin} pts`}</>, e) : tip.hide())}
                    onSelect={(s) => setSelected((cur) => (cur === s.key ? null : s.key))}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[28px] leading-none font-semibold tracking-tight" style={{ color: PARTY_COLORS.D }}>
                      {t.D}
                    </span>
                    <span className="flex gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Dot party="D" />
                        <Dot party="R" />
                        General
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Dot party="D" pale />
                        <Dot party="R" pale />
                        Primary
                      </span>
                    </span>
                    <span className="text-[28px] leading-none font-semibold tracking-tight" style={{ color: PARTY_COLORS.R }}>
                      {t.R}
                    </span>
                  </div>
                </div>
              )}
              {sel.length > 0 && (
                <section className="flex flex-col gap-3 rounded-xl border px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{seatName(st, sel[0])}</span>
                    <Button variant="ghost" size="icon-sm" onClick={() => setSelected(null)} aria-label="Close">
                      <XIcon />
                    </Button>
                  </div>
                  {sel.map((s) => {
                    const total = s.candidates.reduce((a, c) => a + c.votes, 0)
                    return (
                      <div key={s.id} className="flex flex-col gap-1.5">
                        {s.post && <div className="text-[11px] tracking-wider text-muted-foreground uppercase">Seat {s.post}</div>}
                        <p className="text-[12.5px] text-muted-foreground">
                          {s.tier === "nobody" ? `${s.winner} ran unopposed` : `${s.winner} by ${s.margin} points`}
                          {s.now !== s.party ? `. Flips to ${PARTY_NAME[s.now]} under this rule` : s.moved && s.matchup ? `. November under this rule: ${s.matchup.join(" v. ")}` : ""}.
                        </p>
                        {s.candidates.map((c) => (
                          <div key={c.name} className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-2 text-[12.5px]">
                            <span className="truncate">
                              {person(c.name)} <span className="text-muted-foreground">({c.party || "—"})</span>
                            </span>
                            <span className="text-right text-muted-foreground tabular-nums">{number.format(c.votes)}</span>
                            <span className="col-span-full -mt-0.5 h-2 rounded-e-[3px]" style={{ width: `${total ? (c.votes / total) * 100 : 0}%`, background: SEAT_COLOR[norm(c.party)], opacity: person(c.name) === s.winner ? 1 : 0.45 }} />
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </section>
              )}
              {changed.length > 0 && !sel.length && (
                <div>
                  <h3 className="mb-2 text-[11px] tracking-wider text-muted-foreground uppercase">
                    {ruleKind === "top2" || ruleKind === "top4" ? "Seats moved to November" : "Seats that flip"} · {changed.length}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {changed.slice(0, 60).map((x) => (
                      <button key={x.id} type="button" onClick={() => setSelected(x.key)} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs leading-none hover:border-foreground">
                        <span className="size-2.5 rounded-full" style={{ background: SEAT_COLOR[x.now] }} />
                        {seatShort(st, x)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {tip.node}
    </div>
  )
}
