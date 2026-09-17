"use client"

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/toggle-group"

import { Chip } from "@/components/chip"
import { SEAT_COLOR } from "@/components/elections/hemicycle"
import { person } from "@/lib/elections/names"
import { STATE_NAMES, lowerChamber } from "@/lib/filters"
import { advancing, norm, type PrimaryRace } from "@/lib/elections/seats"

// The pooled-primary view, one race at a time: the party primaries as run,
// each party's nominee marked, then the same candidates re-sorted into one
// open primary with the top two or top four advancing. The rows slide into
// their new order so the pooling is watched, not read. The year's file is
// fetched from the public bucket when a race is opened.

export type TopTwoYear = { year: number; url: string; races: number; offices: string[] }
export type Pool = "run" | "two" | "four"
export type RaceSubject = { year: number; state: string; office: string; district: string; url: string }

const PRESSED = "aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
const number = new Intl.NumberFormat("en-US")

export function raceName(r: { state: string; office: string; district: string; year: number; label?: string }) {
  const st = STATE_NAMES[r.state] ?? r.state
  if (r.office === "US SENATE") return `${st} Senate, ${r.year}`
  if (r.office === "STATE SENATE") return `${st} Senate ${r.district}, ${r.year}`
  if (r.office === "STATE HOUSE") return `${st} ${lowerChamber(r.state)} ${r.district}, ${r.year}`
  const n = Number(r.district)
  const ord = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"
  return `${st}${r.district === "0" ? " at large" : ` ${n}${ord}`}, ${r.year}`
}

const Party = ({ p }: { p: string }) => <span className={norm(p) === "D" ? "text-[var(--party-d)]" : norm(p) === "R" ? "text-[var(--party-r)]" : "text-muted-foreground"}>({p})</span>

export function topTwoSentence(race: PrimaryRace, pool: Pool): React.ReactNode {
  const by = new Map(race.candidates.map((c) => [c.name, c]))
  const wp = (n: string) => (
    <React.Fragment key={n}>
      <Chip>{person(n)}</Chip> <Party p={by.get(n)?.party ?? "?"} />
    </React.Fragment>
  )
  const list = (a: string[]) =>
    a.length > 2 ? (
      <>
        {a.slice(0, -1).map((n, i) => (
          <React.Fragment key={n}>
            {i ? ", " : ""}
            {wp(n)}
          </React.Fragment>
        ))}{" "}
        and {wp(a[a.length - 1])}
      </>
    ) : (
      <>
        {wp(a[0])}
        {a[1] && <> and {wp(a[1])}</>}
      </>
    )
  if (race.system !== "party primaries")
    return race.system === "top-two" ? (
      <>
        {STATE_NAMES[race.state]} already sends its top two to November, whatever their party: {list(race.general_two)}.
      </>
    ) : race.system === "top-four" ? (
      <>Alaska already sends its top four to a ranked-choice November.</>
    ) : (
      <>Louisiana puts every candidate on one November ballot, so there is no primary to pool.</>
    )
  if (!race.complete) return <>{(race.missing ?? "A nominee's primary was not counted").replace(/\.$/, "")}, so this race can&rsquo;t be pooled.</>
  if (pool === "run") return <>Two primaries sent {list(race.general_two)} to November.</>
  const adv = advancing(race, pool)
  const parties = adv.map((n) => norm(by.get(n)?.party))
  const d = parties.filter((x) => x === "D").length
  const r = parties.filter((x) => x === "R").length
  const num = (k: number) => ["", "one", "two", "three", "four"][k] ?? String(k)
  const mix = d && r ? `${num(d)} Democrat${d > 1 ? "s" : ""} and ${num(r)} Republican${r > 1 ? "s" : ""}` : d ? `${num(d)} Democrat${d > 1 ? "s" : ""}` : `${num(r)} Republican${r > 1 ? "s" : ""}`
  if (pool === "four")
    return (
      <>
        One primary sending four on would have put {list(adv)} on a ranked-choice November ballot: <b>{mix}</b>.
      </>
    )
  if (race.same_party)
    return (
      <>
        One primary would have sent {list(adv)}, <b>two {parties[0] === "D" ? "Democrats" : "Republicans"}</b>, to November.
      </>
    )
  return race.differs ? <>One primary would have sent {list(adv)} to November instead.</> : <>One primary would have sent the same two: {list(adv)}.</>
}

function Pooled({ race, pool }: { race: PrimaryRace; pool: Pool }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const prev = React.useRef<Map<string, number> | null>(null)
  const pooled = pool !== "run"
  const cands = race.candidates.filter((c) => (c.primary ?? 0) > 0)
  const max = Math.max(1, ...cands.map((c) => c.primary ?? 0))
  const parties = [...new Set(cands.map((c) => c.party))].sort((a, b) => (a === "D" ? -1 : b === "D" ? 1 : a === "R" ? -1 : b === "R" ? 1 : 0))
  const nominees = new Set(parties.map((p) => cands.filter((c) => c.party === p).sort((a, b) => (b.primary ?? 0) - (a.primary ?? 0))[0].name))
  const top = new Set(pooled ? advancing(race, pool) : [])
  const k = pool === "four" ? 4 : 2
  const list = pooled ? [...cands].sort((a, b) => (b.primary ?? 0) - (a.primary ?? 0)) : parties.flatMap((p) => cands.filter((c) => c.party === p).sort((a, b) => (b.primary ?? 0) - (a.primary ?? 0)))

  // FLIP: remember where each row was, then slide it from there to where it is now.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const now = new Map<string, number>()
    el.querySelectorAll<HTMLElement>("[data-n]").forEach((d) => now.set(d.dataset.n ?? "", d.getBoundingClientRect().top))
    if (prev.current) {
      for (const [key, y] of prev.current) {
        const d = el.querySelector<HTMLElement>(`[data-n="${CSS.escape(key)}"]`)
        if (!d || !now.has(key)) continue
        const dy = y - (now.get(key) ?? y)
        if (dy) d.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" })
      }
    }
    prev.current = now
  })

  let lastP: string | null = null
  return (
    <div ref={ref} className="flex w-full flex-col gap-1">
      {list.map((c, i) => {
        const adv = pooled ? top.has(c.name) : nominees.has(c.name)
        const head = !pooled && c.party !== lastP ? (lastP = c.party) : null
        return (
          <React.Fragment key={c.name}>
            {head && <div className={`text-[11px] tracking-wider text-muted-foreground uppercase ${i ? "mt-3.5" : ""} mb-1`}>{c.party === "D" ? "Democratic primary" : c.party === "R" ? "Republican primary" : `${c.party} primary`}</div>}
            {pooled && i === k && (
              <div className="relative my-1 border-t border-dashed border-foreground">
                <span className="absolute -top-2 right-0 bg-background pl-2 text-[11px] tracking-wider text-muted-foreground uppercase">{k} advance</span>
              </div>
            )}
            <div data-n={c.name} className="grid grid-cols-[22px_minmax(0,1fr)_72px] items-center gap-2.5 py-0.5 text-[13.5px] transition-opacity" style={{ opacity: pooled && i >= k ? 0.6 : 1 }}>
              <span className="size-4 rounded-full" style={{ background: adv ? SEAT_COLOR[norm(c.party)] : "#fff", boxShadow: `inset 0 0 0 2px ${SEAT_COLOR[norm(c.party)]}` }} />
              <span className="min-w-0">
                <span className="block truncate">
                  {person(c.name)} <Party p={c.party} />
                  {c.incumbent && <span className="ml-1.5 text-[10px] tracking-wider text-muted-foreground uppercase">incumbent</span>}
                </span>
                <span className="block h-[7px] rounded-e-[3px]" style={{ width: `${((c.primary ?? 0) / max) * 100}%`, background: SEAT_COLOR[norm(c.party)], opacity: adv ? 1 : 0.35 }} />
              </span>
              <span className="text-right text-muted-foreground tabular-nums">{number.format(c.primary ?? 0)}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

export function TopTwo({ subject, pool, onPool, renderSentence, renderReading }: { subject: RaceSubject; pool: Pool; onPool: (p: Pool) => void; renderSentence: (node: React.ReactNode) => void; renderReading: (r: { title: string; body: React.ReactNode } | null) => void }) {
  const [race, setRace] = React.useState<PrimaryRace | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let live = true
    setRace(null)
    setFailed(false)
    fetch(subject.url)
      .then((r) => (r.ok ? (r.json() as Promise<{ races: PrimaryRace[] }>) : Promise.reject(r.status)))
      .then((body) => {
        if (!live) return
        const found = body.races.find((r) => r.state === subject.state && r.office === subject.office && String(Number(r.district)) === String(Number(subject.district)))
        if (found) setRace(found)
        else setFailed(true)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [subject])

  React.useEffect(() => {
    renderSentence(race ? topTwoSentence(race, pool) : null)
  }, [race, pool, renderSentence])

  const can = race ? race.system === "party primaries" && race.complete : false
  React.useEffect(() => {
    if (!race) return renderReading(null)
    const by = new Map(race.candidates.map((c) => [c.name, c]))
    const adv = can ? advancing(race, pool === "run" ? "two" : pool) : race.general_two
    const two = pool === "run" || !can ? race.general_two : adv
    renderReading({
      title: `November${pool === "four" && can ? ", counted by ranked choice" : ""}`,
      body: (
        <>
          <div className="flex flex-col gap-2">
            {two.map((nm) => {
              const c = by.get(nm)
              const won = nm === race.general_winner
              return (
                <div key={nm} className="flex items-baseline justify-between gap-2.5 text-sm">
                  <span>
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: SEAT_COLOR[norm(c?.party)] }} />
                    {person(nm)} <Party p={c?.party ?? "?"} />
                  </span>
                  <span className={`tabular-nums ${won ? "font-semibold" : "text-muted-foreground"}`}>{pool === "run" && c?.general != null ? number.format(c.general) : "—"}</span>
                </div>
              )
            })}
          </div>
          {can && pool === "four" && <p className="mt-2.5 text-xs text-muted-foreground">Nobody ranked these candidates, so there is no count to run. The general vote shown under &ldquo;as run&rdquo; is the real one.</p>}
          {can && pool === "two" && race.differs && <p className="mt-2.5 text-xs text-muted-foreground">The general vote is the real one; a changed November has no count to show.</p>}
        </>
      ),
    })
  }, [race, pool, can, renderReading])

  if (failed) return <p className="text-sm text-destructive">This race&rsquo;s primaries could not be read.</p>
  if (!race) return <p className="py-16 text-center text-sm text-muted-foreground">Reading the {subject.year} primaries…</p>
  return (
    <div className="flex flex-col gap-5">
      <div data-tour="rules">
        <ToggleGroup value={[pool]} onValueChange={(next) => next?.[0] && onPool(next[0] as Pool)} variant="outline" spacing={1}>
          <ToggleGroupItem value="run" className={PRESSED}>
            Two primaries, as run
          </ToggleGroupItem>
          <ToggleGroupItem value="two" className={PRESSED} disabled={!can}>
            One primary, top two advance
          </ToggleGroupItem>
          <ToggleGroupItem value="four" className={PRESSED} disabled={!can}>
            One primary, top four advance
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div data-tour="ring">
        <Pooled race={race} pool={can ? pool : "run"} />
      </div>
    </div>
  )
}
