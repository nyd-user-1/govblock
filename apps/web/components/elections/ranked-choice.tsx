"use client"

import * as React from "react"

import { Chip } from "@/components/chip"
import { useTip } from "@/components/elections/tip"
import { person, surname } from "@/lib/elections/names"
import { condorcetWinner, headToHead, instantRunoff, type Count, type Profile } from "@/lib/elections/tabulate"
import { PARTY_COLORS } from "@/lib/map/palette"

// The ranked-choice view: a contest's ballots replayed round by round, each
// round a row split by candidate, the eliminated candidate's votes carried
// into the next row as ribbons, a majority tick on every row. The chips are
// the lever: take a candidate out and the count runs again from the same
// ballots. The one-on-one table underneath says whether the winner would
// have beaten each rival alone, the case ranked choice is argued over.

export type ContestSummary = {
  id: string
  title: string
  state: string
  date: string
  ballots: number
  winner: string
  leader: string
  comeback: boolean
  condorcet: string | null
  url: string
}

export type Ballots = {
  id: string
  title: string
  jurisdiction: string
  date: string
  office: string
  party: string | null
  ranks: number
  ballots: number
  candidates: string[]
  profiles: Profile[]
}

const number = new Intl.NumberFormat("en-US")
const pct = (part: number, whole: number, d = 1) => (whole ? `${((part / whole) * 100).toFixed(d)}%` : "—")
const CAT = ["#2563eb", "#ea580c", "#0d9488", "#7c3aed", "#db2777", "#ca8a04", "#64748b", "#0891b2", "#84cc16", "#f43f5e", "#8b5cf6", "#78716c"]
/** Parties the ballot files leave out, for the contests the cases open. */
const HINT: Record<string, Record<string, string>> = {
  "alaska-2022-08-16-us-house-special": { Peltola: "D", Palin: "R", Begich: "R" },
  "maine-2018-11-06-us-house-district-2": { Golden: "D", Poliquin: "R", Bond: "I", Hoar: "I" },
}

/** A general election between parties reads in party colours; a primary or a city race in a fixed categorical order. */
export function candidateColors(data: Ballots) {
  const hint = HINT[data.id] ?? {}
  const parties = data.candidates.map((c) => /\((D|R|DEM|REP)\)/i.exec(c)?.[1]?.[0]?.toUpperCase() ?? hint[surname(c)] ?? null)
  const RED = [PARTY_COLORS.R, "#991b1b", "#f87171"]
  const BLUE = [PARTY_COLORS.D, "#1e3a8a", "#60a5fa"]
  let ri = 0
  let di = 0
  return data.candidates.map((c, i) => {
    if (/write-?in/i.test(c)) return "#a3a3a3"
    const p = data.party ? null : parties[i]
    if (p === "D") return BLUE[di++ % 3]
    if (p === "R") return RED[ri++ % 3]
    if (p === "I") return PARTY_COLORS.I
    return CAT[i % CAT.length]
  })
}

/** Where each eliminated candidate's ballots went in the next round. */
function transfers(n: number, profiles: Profile[], count: Count, removed: ReadonlySet<number>) {
  const inCount = Array.from({ length: n }, (_, i) => !removed.has(i))
  const out: { from: number; to: number[]; exhausted: number }[] = []
  for (let r = 0; r < count.rounds.length - 1; r++) {
    const gone = count.rounds[r].out
    if (gone === null) break
    const to = new Array<number>(n).fill(0)
    let exhausted = 0
    for (const p of profiles) {
      let top = -1
      for (let k = 1; k < p.length; k++)
        if (inCount[p[k]]) {
          top = p[k]
          break
        }
      if (top !== gone) continue
      let next = -1
      for (let k = 1; k < p.length; k++)
        if (inCount[p[k]] && p[k] !== gone) {
          next = p[k]
          break
        }
      if (next < 0) exhausted += p[0]
      else to[next] += p[0]
    }
    out.push({ from: gone, to, exhausted })
    inCount[gone] = false
  }
  return out
}

export function Rounds({ data, removed, colors, onHover }: { data: Ballots; removed: ReadonlySet<number>; colors: string[]; onHover: (body: React.ReactNode | null, e?: React.MouseEvent) => void }) {
  const n = data.candidates.length
  const count = React.useMemo(() => instantRunoff(n, data.profiles, removed), [n, data.profiles, removed])
  const tr = React.useMemo(() => transfers(n, data.profiles, count, removed), [n, data.profiles, count, removed])
  const W = 640
  const RH = 36
  const GAP = 62
  const LEFT = 52
  const RIGHT = 104
  const inner = W - LEFT - RIGHT
  const total = data.ballots
  const order = [...Array(n).keys()].filter((i) => !removed.has(i)).sort((a, b) => (count.rounds[0].votes[b] ?? 0) - (count.rounds[0].votes[a] ?? 0))
  const rows = count.rounds
  const H = rows.length * RH + (rows.length - 1) * GAP + 30
  const segs: Record<number, { x: number; w: number }>[] = []
  const marks: React.ReactNode[] = []
  rows.forEach((r, ri) => {
    const y = ri * (RH + GAP)
    let x = LEFT
    const cont = order.reduce((a, i) => a + (r.votes[i] ?? 0), 0)
    const m: Record<number, { x: number; w: number }> = {}
    order.forEach((i) => {
      const v = r.votes[i]
      if (v == null) return
      const w = (v / total) * inner
      m[i] = { x, w }
      const win = ri === rows.length - 1 && i === count.winner
      const prev = ri ? rows[ri - 1].votes[i] : null
      const gain = prev != null ? v - prev : 0
      marks.push(
        <g key={`${ri}-${i}`}>
          <rect
            x={x}
            y={y}
            width={Math.max(w, 0)}
            height={RH}
            fill={colors[i]}
            opacity={r.out === i ? 0.55 : 1}
            onMouseMove={(e) =>
              onHover(
                <>
                  <b>{person(data.candidates[i])}</b> · round {ri + 1}
                  <br />
                  {number.format(v)} · {pct(v, cont)}
                  {gain > 0 && <span className="text-background/70"> +{number.format(gain)}</span>}
                </>,
                e
              )
            }
            onMouseLeave={() => onHover(null)}
          />
          {w > 48 && (
            <text x={x + 8} y={y + RH / 2 + 4} fontSize={12} fill="#fff" fontWeight={500} pointerEvents="none">
              {surname(data.candidates[i])}
              {win ? " ✓" : ""}
            </text>
          )}
        </g>
      )
      x += w + 2
    })
    const exW = (r.exhausted / total) * inner
    if (exW > 0) marks.push(<rect key={`ex-${ri}`} x={x} y={y} width={exW} height={RH} fill="url(#rcv-hatch)" />)
    const mx = LEFT + (cont / 2 / total) * inner
    marks.push(<line key={`mj-${ri}`} x1={mx} y1={y - 4} x2={mx} y2={y + RH + 4} stroke="currentColor" strokeWidth={1.5} />)
    if (ri === 0)
      marks.push(
        <text key="mjl" x={mx} y={y - 8} fontSize={11} textAnchor="middle" fill="#737373">
          majority
        </text>
      )
    marks.push(
      <text key={`rl-${ri}`} x={LEFT - 8} y={y + RH / 2 + 4} fontSize={11} textAnchor="end" fill="#737373">
        Round {ri + 1}
      </text>
    )
    if (r.out != null)
      marks.push(
        <text key={`out-${ri}`} x={LEFT + inner + 6} y={y + RH / 2 + 4} fontSize={11} fill="#737373">
          − {surname(data.candidates[r.out])}
        </text>
      )
    else if (count.winner >= 0)
      marks.push(
        <text key={`win-${ri}`} x={LEFT + inner + 6} y={y + RH / 2 + 4} fontSize={11} fill="currentColor" fontWeight={600}>
          {surname(data.candidates[count.winner])} {pct(r.votes[count.winner] ?? 0, cont)}
        </text>
      )
    segs.push(m)
  })
  const ribbons: React.ReactNode[] = []
  tr.forEach((t, ri) => {
    const y0 = ri * (RH + GAP) + RH
    const y1 = (ri + 1) * (RH + GAP)
    const from = segs[ri][t.from]
    if (!from) return
    let fx = from.x
    order.forEach((i) => {
      const v = t.to[i]
      const dst = segs[ri + 1]?.[i]
      if (!v || !dst) return
      const w = (v / total) * inner
      const dx = dst.x + dst.w - w
      ribbons.push(<path key={`rb-${ri}-${i}`} d={`M${fx},${y0} L${fx + w},${y0} C${fx + w},${y0 + GAP / 2} ${dx + w},${y1 - GAP / 2} ${dx + w},${y1} L${dx},${y1} C${dx},${y1 - GAP / 2} ${fx},${y0 + GAP / 2} ${fx},${y0} Z`} fill={colors[i]} opacity={0.28} />)
      fx += w
    })
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible">
      <defs>
        <pattern id="rcv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#fafafa" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#d4d4d4" strokeWidth="2" />
        </pattern>
      </defs>
      {ribbons}
      {marks}
    </svg>
  )
}

export function OneOnOne({ data, wins, removed, colors }: { data: Ballots; wins: number[][]; removed: ReadonlySet<number>; colors: string[] }) {
  const idx = [...Array(data.candidates.length).keys()].filter((i) => !removed.has(i) && !/write-?in/i.test(data.candidates[i])).slice(0, 8)
  return (
    <table className="w-full border-collapse text-[13.5px] tabular-nums">
      <caption className="pt-2 text-left text-xs text-muted-foreground [caption-side:bottom]">Share of ballots that rank the row&rsquo;s candidate above the column&rsquo;s. Green cells are wins.</caption>
      <thead>
        <tr>
          <th className="border-b py-2 pr-3 text-left" />
          {idx.map((j) => (
            <th key={j} className="border-b px-3 py-2 text-right text-xs font-medium text-muted-foreground" title={data.candidates[j]}>
              {surname(data.candidates[j])}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {idx.map((i) => (
          <tr key={i}>
            <th className="border-b py-2 pr-3 text-left font-normal whitespace-nowrap" title={data.candidates[i]}>
              <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: colors[i] }} />
              {surname(data.candidates[i])}
            </th>
            {idx.map((j) => {
              if (i === j)
                return (
                  <td key={j} className="border-b px-3 py-2 text-right text-muted-foreground/60">
                    —
                  </td>
                )
              const both = wins[i][j] + wins[j][i]
              const ahead = wins[i][j] > wins[j][i]
              return (
                <td key={j} className={`border-b px-3 py-2 text-right ${ahead ? "bg-emerald-50 font-semibold dark:bg-emerald-950/40" : "text-muted-foreground"}`} title={`${number.format(wins[i][j])} ballots rank ${surname(data.candidates[i])} above ${surname(data.candidates[j])}`}>
                  {pct(wins[i][j], both, 0)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function rcvSentence(data: Ballots, count: Count, wins: number[][], removed: ReadonlySet<number>): React.ReactNode {
  const n = data.candidates.length
  const name = (i: number) => <Chip>{person(data.candidates[i])}</Chip>
  if (count.winner < 0) return "No candidate is left in the count."
  const rounds = count.rounds.length
  const c = condorcetWinner(wins, removed)
  const asCast = removed.size ? instantRunoff(n, data.profiles) : null
  return (
    <>
      {name(count.winner)} wins{rounds > 1 ? ` in round ${rounds}` : " outright"}.{count.leader >= 0 && count.leader !== count.winner && <> {person(data.candidates[count.leader])} led on first choices.</>}
      {c >= 0 && c !== count.winner && <> {person(data.candidates[c])} beats every other candidate one on one.</>}
      {asCast && asCast.winner !== count.winner && asCast.winner >= 0 && <> With everyone in, {person(data.candidates[asCast.winner])} won.</>}
    </>
  )
}

export function RankedChoice({ contest, removed, onRemoved, renderSentence, renderReading }: { contest: ContestSummary; removed: ReadonlySet<number>; onRemoved: (next: Set<number>) => void; renderSentence: (node: React.ReactNode) => void; renderReading: (r: { title: string; body: React.ReactNode } | null) => void }) {
  const [data, setData] = React.useState<Ballots | null>(null)
  const [failed, setFailed] = React.useState(false)
  const tip = useTip()

  React.useEffect(() => {
    let live = true
    setData(null)
    setFailed(false)
    fetch(contest.url)
      .then((r) => (r.ok ? (r.json() as Promise<Ballots>) : Promise.reject(r.status)))
      .then((body) => live && setData(body))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [contest])

  const n = data?.candidates.length ?? 0
  const colors = React.useMemo(() => (data ? candidateColors(data) : []), [data])
  const wins = React.useMemo(() => (data ? headToHead(n, data.profiles) : []), [data, n])
  const count = React.useMemo(() => (data ? instantRunoff(n, data.profiles, removed) : null), [data, n, removed])

  React.useEffect(() => {
    renderSentence(data && count ? rcvSentence(data, count, wins, removed) : null)
  }, [data, count, wins, removed, renderSentence])

  React.useEffect(() => {
    if (!data || !count) return renderReading(null)
    const cw = condorcetWinner(wins, removed)
    renderReading({
      title: "One on one",
      body: (
        <>
          <p className="mb-3 text-sm">
            {cw >= 0 ? (
              <>
                <b>{person(data.candidates[cw])}</b> beats every other candidate one on one{count.winner >= 0 && cw !== count.winner ? ", and still loses the count" : ""}.
              </>
            ) : (
              "No candidate beats every other one on one."
            )}
          </p>
          <OneOnOne data={data} wins={wins} removed={removed} colors={colors} />
        </>
      ),
    })
  }, [data, count, wins, removed, colors, renderReading])

  if (failed) return <p className="text-sm text-destructive">The ballots for this contest could not be read.</p>
  if (!data || !count) return <p className="py-16 text-center text-sm text-muted-foreground">Reading {number.format(contest.ballots)} ballots…</p>

  const order = [...Array(n).keys()].sort((a, b) => (count.rounds[0].votes[b] ?? -1) - (count.rounds[0].votes[a] ?? -1))
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-1.5" data-tour="rules">
        {order.map((i) => {
          const out = removed.has(i)
          return (
            <button
              key={i}
              type="button"
              aria-pressed={!out}
              title={out ? "Put back" : "Take out"}
              onClick={() => {
                const next = new Set(removed)
                if (out) next.delete(i)
                else next.add(i)
                onRemoved(next)
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border py-1.5 pr-2.5 pl-2 text-xs leading-none ${out ? "bg-muted text-muted-foreground line-through" : ""}`}
            >
              <span className="size-2.5 rounded-full" style={out ? { boxShadow: `inset 0 0 0 2px ${colors[i]}` } : { background: colors[i] }} />
              {person(data.candidates[i])}
            </button>
          )
        })}
        {removed.size > 0 && (
          <button type="button" onClick={() => onRemoved(new Set())} className="rounded-full border px-2.5 py-1.5 text-xs leading-none">
            Everyone back
          </button>
        )}
      </div>
      <div data-tour="ring">
        <Rounds data={data} removed={removed} colors={colors} onHover={(body, e) => (body && e ? tip.show(body, e) : tip.hide())} />
      </div>
      {tip.node}
    </div>
  )
}
