"use client"

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/toggle-group"

import { Dot, Hemicycle, SEAT_COLOR } from "@/components/elections/hemicycle"
import { useTip } from "@/components/elections/tip"
import { person } from "@/lib/elections/names"
import {
  PARTY_NAME,
  VOTING_AGE,
  chamberLong,
  chamberName,
  control,
  electorate,
  million,
  norm,
  primaryIndex,
  seatName,
  seatShort,
  seatsFrom,
  simulate,
  tally,
  type PrimaryRace,
  type Results,
  type Rule,
  type SimSeat,
} from "@/lib/elections/seats"

// The chamber view: a claim, then the ring that tests it. "All" shows every
// seat filled in, the chamber as it looks. "Closed" fades the seats settled
// before November in a closed party primary. "Open (T2)" and "Open (T4)"
// pool those primaries and move settled seats back to November wherever the
// advancing candidates give all voters a choice inside the winning party.
// The results file and the year's primaries are fetched from the public
// bucket when the chamber is opened; nothing reads the database.

export type ChamberSubject = { st: string; office: string; year: number; results: string; primaries?: string }
export type ChamberRule = "all" | "held" | "top2" | "top4"

const PRESSED = "aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
const number = new Intl.NumberFormat("en-US")
const P = (p: "D" | "R") => <b className={p === "D" ? "text-[var(--party-d)]" : "text-[var(--party-r)]"}>{PARTY_NAME[p]}</b>
const Score = ({ t }: { t: Record<string, number> }) =>
  t.D > t.R ? (
    <code className="tabular-nums">
      <span className="text-[var(--party-d)]">{t.D}</span>–<span className="text-[var(--party-r)]">{t.R}</span>
    </code>
  ) : (
    <code className="tabular-nums">
      <span className="text-[var(--party-r)]">{t.R}</span>–<span className="text-[var(--party-d)]">{t.D}</span>
    </code>
  )

function Sentence({ subject, seats, rule, hasPrimaries }: { subject: ChamberSubject; seats: SimSeat[]; rule: ChamberRule; hasPrimaries: boolean }) {
  const n = seats.length
  const base = tally(seats.map((s) => ({ ...s, now: s.party })))
  const cb = control(base, n)
  const short = subject.st === "US" ? "House" : chamberName(subject.st, subject.office)
  const nobody = seats.filter((s) => s.tier === "nobody").length
  const safe = seats.filter((s) => s.tier === "safe").length
  const settled = nobody + safe
  const holds = cb === "D" || cb === "R" ? <>{P(cb)} hold</> : <>No party holds</>
  if (rule === "all")
    return (
      <>
        There are <code>{n}</code> seats in the {chamberLong(subject.st, subject.office)}. {holds} the {short} <Score t={base} />.
      </>
    )
  if (rule === "top2" || rule === "top4") {
    const moved = seats.filter((s) => s.moved).length
    if (!hasPrimaries) return <>This chamber&rsquo;s primaries are not on file, so an open primary cannot be run on it yet.</>
    return rule === "top2" ? (
      <>
        One open primary, top two advancing, moves <code>{moved}</code> of <code>{settled}</code> settled seats to November for all voters to decide.
      </>
    ) : (
      <>
        One open primary, four advancing, moves <code>{moved}</code> of <code>{settled}</code> settled seats to a ranked-choice November with a choice inside the winning party.
      </>
    )
  }
  const va = VOTING_AGE[subject.st]
  if (hasPrimaries && va) {
    const e = electorate(seats)
    return (
      <>
        <code>{settled}</code> of <code>{n}</code> seats were settled before November, in primaries that <code>{million(e.settledPrimary)}</code> people voted in: <code>{Math.round((e.settledPrimary / va.cvap) * 100)}%</code> of voting-age citizens.
      </>
    )
  }
  return (
    <>
      <code>{settled}</code> of <code>{n}</code> seats were settled before November: <code>{nobody}</code> with no opponent, <code>{safe}</code> won by 20 points or more. {holds} the {short} <Score t={base} />.
    </>
  )
}

function SeatCard({ st, seat, rule }: { st: string; seat: SimSeat; rule: ChamberRule }) {
  const tot = seat.candidates.reduce((a, c) => a + c.votes, 0)
  const r = seat.race
  const pc = r ? r.candidates.filter((c) => (c.primary ?? 0) > 0).sort((a, b) => (b.primary ?? 0) - (a.primary ?? 0)) : []
  const pmax = Math.max(1, ...pc.map((c) => c.primary ?? 0))
  const ptot = pc.reduce((a, c) => a + (c.primary ?? 0), 0)
  const decided = seat.tier === "nobody" ? `${seat.winner} ran unopposed` : seat.tier === "safe" ? `${seat.winner} by ${seat.margin} points, settled before November` : `${seat.winner} by ${seat.margin} points`
  const Row = ({ name, party, votes, share, strong }: { name: string; party: string; votes: number; share: number; strong: boolean }) => (
    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-2 text-[12.5px]">
      <span className="truncate">
        {person(name)} <span className="text-muted-foreground">({party || "—"})</span>
      </span>
      <span className="text-right text-muted-foreground tabular-nums">{number.format(votes)}</span>
      <span className="col-span-full -mt-0.5 h-2 rounded-e-[3px]" style={{ width: `${share}%`, background: SEAT_COLOR[norm(party)], opacity: strong ? 1 : 0.45 }} />
    </div>
  )
  return (
    <div className="rounded-xl border px-3.5 py-3">
      <h4 className="text-sm font-semibold">{seatName(st, seat)}</h4>
      <div className="mb-2.5 text-[12.5px] text-muted-foreground">{decided}</div>
      {seat.candidates.map((c) => (
        <Row key={c.name} name={c.name} party={c.party} votes={c.votes} share={tot ? (c.votes / tot) * 100 : 0} strong={person(c.name) === seat.winner} />
      ))}
      {r && pc.length > 0 && (
        <>
          <div className="mt-3 mb-1 text-[11px] tracking-wider text-muted-foreground uppercase">Primaries, as run · {number.format(ptot)} votes</div>
          {pc.slice(0, 5).map((c) => (
            <Row key={c.name} name={c.name} party={c.party} votes={c.primary ?? 0} share={((c.primary ?? 0) / pmax) * 100} strong={false} />
          ))}
          {pc.length > 5 && <div className="text-xs text-muted-foreground">+{pc.length - 5} more</div>}
        </>
      )}
      {r && !pc.length && <p className="mt-2.5 text-xs text-muted-foreground">{(r.missing ?? "No primary vote was counted").replace(/\.$/, "")}.</p>}
      {r && seat.matchup && (rule === "top2" || rule === "top4") && (
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          Under this rule November is <b className="text-foreground">{seat.matchup.join(" v. ")}</b>
          {seat.moved ? ", for all voters to decide" : ""}.
        </p>
      )}
    </div>
  )
}

export type Reading = { title: string; body: React.ReactNode } | null

export function Chamber({ subject, rule, onRule, renderSentence, renderReading }: { subject: ChamberSubject; rule: ChamberRule; onRule: (r: ChamberRule) => void; renderSentence: (node: React.ReactNode) => void; renderReading: (r: Reading) => void }) {
  const [results, setResults] = React.useState<Results | null>(null)
  const [prim, setPrim] = React.useState<Record<string, PrimaryRace> | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [selected, setSelected] = React.useState<string | null>(null)
  const tip = useTip()

  React.useEffect(() => {
    let live = true
    setResults(null)
    setPrim(null)
    setSelected(null)
    setFailed(false)
    fetch(subject.results)
      .then((r) => (r.ok ? (r.json() as Promise<Results>) : Promise.reject(r.status)))
      .then((body) => live && setResults(body))
      .catch(() => live && setFailed(true))
    if (subject.primaries)
      fetch(subject.primaries)
        .then((r) => (r.ok ? (r.json() as Promise<{ races: PrimaryRace[] }>) : Promise.reject(r.status)))
        .then((body) => live && setPrim(primaryIndex(body.races.filter((r) => r.office === subject.office && (subject.st === "US" || r.state === subject.st)), subject.st)))
        .catch(() => {})
    return () => {
      live = false
    }
  }, [subject])

  const base = React.useMemo(() => (results ? seatsFrom(results) : []), [results])
  const seats = React.useMemo(() => simulate(base, { kind: rule, swing: 0 } as Rule, null, prim), [base, rule, prim])
  const hasPrimaries = Boolean(prim && Object.keys(prim).length)
  const t = tally(seats)
  const changed = seats.filter((s) => s.moved)
  const sel = selected ? seats.find((s) => s.id === selected) : undefined

  React.useEffect(() => {
    renderSentence(results ? <Sentence subject={subject} seats={seats} rule={rule} hasPrimaries={hasPrimaries} /> : null)
  }, [results, seats, rule, hasPrimaries, subject, renderSentence])

  // The reading under the chart is the page's next section: the seat clicked, else the seats the rule moved.
  const st = subject.st
  React.useEffect(() => {
    const picked = selected ? seats.find((s) => s.id === selected) : undefined
    const moved = seats.filter((s) => s.moved)
    if (picked) renderReading({ title: seatName(st, picked), body: <SeatCard st={st} seat={picked} rule={rule} /> })
    else if (moved.length)
      renderReading({
        title: `Seats moved to November · ${moved.length}`,
        body: (
          <div className="flex flex-wrap gap-1.5">
            {moved.slice(0, 48).map((x) => (
              <button key={x.id} type="button" onClick={() => setSelected(x.id)} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs leading-none hover:border-foreground">
                <span className="size-2.5 rounded-full" style={{ background: SEAT_COLOR[x.now] }} />
                {seatShort(st, x)}
                {x.matchup && <span className="text-muted-foreground">{x.matchup.map((m) => /\((\w+)\)$/.exec(m)?.[1] ?? "").join("·")}</span>}
              </button>
            ))}
            {moved.length > 48 && <span className="text-xs text-muted-foreground">+{moved.length - 48} more</span>}
          </div>
        ),
      })
    else renderReading(null)
  }, [selected, seats, rule, st, renderReading])

  if (failed) return <p className="text-sm text-destructive">This chamber&rsquo;s results could not be read.</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5" data-tour="rules">
        <ToggleGroup value={[rule]} onValueChange={(next) => next?.[0] && onRule(next[0] as ChamberRule)} variant="outline" spacing={1}>
          <ToggleGroupItem value="all" className={PRESSED}>
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="held" className={PRESSED}>
            Closed
          </ToggleGroupItem>
          <ToggleGroupItem value="top2" className={PRESSED} disabled={!subject.primaries}>
            Open (T2)
          </ToggleGroupItem>
          <ToggleGroupItem value="top4" className={PRESSED} disabled={!subject.primaries}>
            Open (T4)
          </ToggleGroupItem>
        </ToggleGroup>
        {!subject.primaries && <p className="text-xs text-muted-foreground">Open-primary rules need this chamber&rsquo;s primaries, which are not loaded for {subject.year}.</p>}
      </div>

      <div data-tour="ring">
        {results ? (
          <>
            <Hemicycle
              seats={seats}
              plain={rule === "all"}
              size={640}
              selected={selected}
              onHover={(seat, e) => {
                if (!seat || !e) return tip.hide()
                tip.show(
                  <>
                    <b>{seatName(subject.st, seat)}</b>
                    <br />
                    {seat.tier === "nobody" ? `${seat.winner} · no opponent` : `${seat.winner} (${seat.party}) by ${seat.margin} pts`}
                    {seat.moved && seat.matchup && (
                      <>
                        <br />
                        <span className="text-background/70">November: {seat.matchup.join(" v. ")}</span>
                      </>
                    )}
                  </>,
                  e
                )
              }}
              onSelect={(seat) => setSelected((cur) => (cur === seat.id ? null : seat.id))}
            />
            <div className="mt-1 flex items-center gap-5" data-tour="counts">
              <span className="min-w-[2ch] text-[32px] leading-none font-semibold tracking-tight text-[var(--party-d)]">{t.D}</span>
              <div className="flex flex-1 flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Dot party="D" />
                  <Dot party="R" />
                  General
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Dot party="D" pale />
                  <Dot party="R" pale />
                  Primary
                </span>
              </div>
              <span className="min-w-[2ch] text-right text-[32px] leading-none font-semibold tracking-tight text-[var(--party-r)]">{t.R}</span>
            </div>
          </>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">Reading every district…</p>
        )}
      </div>

      {tip.node}
    </div>
  )
}
