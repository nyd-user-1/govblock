"use client"

import Link from "next/link"
import * as React from "react"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@govblock/ui/components/animate-ui/components/animate/tabs"
import { Button } from "@govblock/ui/components/ny4/button"
import { NativeSelect, NativeSelectOption } from "@govblock/ui/components/native-select"

import { Chamber, type ChamberRule, type ChamberSubject, type Reading } from "@/components/elections/chamber"
import { RankedChoice, type ContestSummary } from "@/components/elections/ranked-choice"
import { TopTwo, raceName, type Pool, type RaceSubject, type TopTwoYear } from "@/components/elections/top-two"
import { Tour, type TourStep } from "@/components/elections/tour"
import { PublicRail } from "@/components/block-card"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { RightRailSheet } from "@/components/rail-sheet"
import { PreviewFrame } from "@/components/preview-frame"
import { H2, H3 } from "@/components/typeset"
import { FlagChip } from "@/components/policy/imagery"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { chamberName, subjectName, type PrimaryRace } from "@/lib/elections/seats"
import { STATE_NAMES, stateName } from "@/lib/filters"
import { PARTY_COLORS } from "@/lib/map/palette"
import { cn } from "@govblock/ui/lib/utils"

// /simulator. Every view opens on a claim and then lets the reader test it
// against the real count: a chamber's seats by where they were decided and
// the open-primary rules that move them; a ranked-choice contest replayed
// from its ballots with any candidate taken out; a race's party primaries
// pooled into one. The cases at the foot open a view already set up on a
// real story; everything else on file is reachable under them. The page
// carries three small lists and reads nothing else on load; a chamber's
// results, a contest's ballots or a year's primaries arrive when picked.

export type HouseView = { year: number; congress: number; results: string }
export type ChamberView = { year: number; state: string; office: "STATE HOUSE" | "STATE SENATE"; results: string }

type Subject = { kind: "chamber"; chamber: ChamberSubject } | { kind: "rcv"; contest: ContestSummary } | { kind: "race"; race: RaceSubject }
type Preset = { rule?: ChamberRule; pool?: Pool; removed?: number[] }
type Case = { title: string; hint: string; state: string; subject: Subject; preset: Preset }

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const longDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`
const number = new Intl.NumberFormat("en-US")

function primariesFor(years: TopTwoYear[], office: string, year: number) {
  return years.find((y) => y.year === year && y.offices.includes(office))?.url
}

export function Simulator({ contests, years, house, chambers }: { contests: ContestSummary[]; years: TopTwoYear[]; house: HouseView[]; chambers: ChamberView[] }) {
  const chamberSubject = React.useCallback(
    (st: string, office: string, year: number): ChamberSubject | null => {
      const results = st === "US" ? house.find((h) => h.year === year)?.results : chambers.find((c) => c.state === st && c.office === office && c.year === year)?.results
      return results ? { st, office, year, results, primaries: primariesFor(years, office, year) } : null
    },
    [house, chambers, years]
  )
  const cases = React.useMemo<Case[]>(() => {
    const out: Case[] = []
    const h22 = chamberSubject("US", "US HOUSE", 2022)
    if (h22) out.push({ title: "288 decided in the Primary", hint: "U.S. House 2022", state: "US", subject: { kind: "chamber", chamber: h22 }, preset: { rule: "held" } })
    const ak = contests.find((c) => c.id === "alaska-2022-08-16-us-house-special")
    if (ak) out.push({ title: "Begich beat everyone one on one. He finished third.", hint: "Alaska special election 2022", state: "AK", subject: { kind: "rcv", contest: ak }, preset: {} })
    const wi = chamberSubject("WI", "STATE HOUSE", 2024)
    if (wi) out.push({ title: "64 of 99 Wisconsin Assembly seats were settled before November", hint: "Wisconsin Assembly 2024", state: "WI", subject: { kind: "chamber", chamber: wi }, preset: { rule: "held" } })
    const y22 = years.find((y) => y.year === 2022)
    if (y22) out.push({ title: "Two Democrats would have met in November", hint: "Texas 28th, 2022", state: "TX", subject: { kind: "race", race: { year: 2022, state: "TX", office: "US HOUSE", district: "28", url: y22.url } }, preset: { pool: "two" } })
    const bu = contests.find((c) => c.id === "burlington-2009-03-03-mayor")
    if (bu) out.push({ title: "Kiss won. Montroll beat him one on one.", hint: "Burlington mayor 2009", state: "VT", subject: { kind: "rcv", contest: bu }, preset: {} })
    return out
  }, [contests, years, chamberSubject])

  const [subject, setSubject] = React.useState<Subject | null>(null)
  const [rule, setRule] = React.useState<ChamberRule>("all")
  const [pool, setPool] = React.useState<Pool>("run")
  const [removed, setRemoved] = React.useState<ReadonlySet<number>>(new Set())
  const [sentence, setSentence] = React.useState<React.ReactNode>(null)
  const [reading, setReading] = React.useState<Reading>(null)
  const renderReading = React.useCallback((r: Reading) => setReading(r), [])
  const [tour, setTour] = React.useState(false)
  const [browse, setBrowse] = React.useState(false)
  const renderSentence = React.useCallback((node: React.ReactNode) => setSentence(node), [])

  const open = React.useCallback((s: Subject, preset: Preset = {}) => {
    setSubject(s)
    setRule(preset.rule ?? "all")
    setPool(preset.pool ?? "run")
    setRemoved(new Set(preset.removed ?? []))
    setSentence(null)
    setReading(null)
    const url = new URL(window.location.href)
    for (const k of ["c", "chamber", "race", "rule", "pool"]) url.searchParams.delete(k)
    if (s.kind === "rcv") url.searchParams.set("c", s.contest.id)
    else if (s.kind === "chamber") {
      url.searchParams.set("chamber", `${s.chamber.st}|${s.chamber.office}|${s.chamber.year}`)
      if (preset.rule && preset.rule !== "all") url.searchParams.set("rule", preset.rule)
    } else {
      url.searchParams.set("race", `${s.race.year}|${s.race.state}|${s.race.office}|${s.race.district}`)
      if (preset.pool && preset.pool !== "run") url.searchParams.set("pool", preset.pool)
    }
    window.history.replaceState(null, "", url)
  }, [])

  // A shared link names its subject; opening the link is the click. Otherwise the first case.
  React.useEffect(() => {
    const q = new URL(window.location.href).searchParams
    const c = q.get("c")
    const named = c ? contests.find((x) => x.id === c) : null
    if (named) return open({ kind: "rcv", contest: named })
    const ch = q.get("chamber")?.split("|")
    if (ch?.length === 3) {
      const s = chamberSubject(ch[0], ch[1], Number(ch[2]))
      if (s) return open({ kind: "chamber", chamber: s }, { rule: (q.get("rule") as ChamberRule) || "all" })
    }
    const ra = q.get("race")?.split("|")
    if (ra?.length === 4) {
      const y = years.find((x) => x.year === Number(ra[0]))
      if (y) return open({ kind: "race", race: { year: Number(ra[0]), state: ra[1], office: ra[2], district: ra[3], url: y.url } }, { pool: (q.get("pool") as Pool) || "run" })
    }
    if (cases[0]) open(cases[0].subject, {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (!localStorage.getItem("simulator-tour")) {
      localStorage.setItem("simulator-tour", "1")
      const t = setTimeout(() => setTour(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  // "Alaska U.S. House, special election, 2022" → the name, then "Special election 2022" among the facts.
  const parts = subject?.kind === "rcv" ? subject.contest.title.split(/,\s*/) : []
  const title = subject ? (subject.kind === "chamber" ? (subject.chamber.st === "US" ? "U.S. House" : `${STATE_NAMES[subject.chamber.st] ?? subject.chamber.st} ${chamberName(subject.chamber.st, subject.chamber.office)}`) : subject.kind === "rcv" ? parts[0] : raceName(subject.race).replace(/,\s*\d{4}$/, "")) : ""
  const flag = subject ? (subject.kind === "chamber" ? subject.chamber.st : subject.kind === "rcv" ? subject.contest.state : subject.race.state) : "US"
  const meta: string[] = !subject
    ? []
    : subject.kind === "rcv"
      ? [`${parts.length > 2 ? parts.slice(1, -1).join(", ").replace(/^./, (c) => c.toUpperCase()) + " " : ""}${parts[parts.length - 1]}`, `${number.format(subject.contest.ballots)} ballots`]
      : subject.kind === "chamber"
        ? [`General election ${subject.chamber.year}`, subject.chamber.primaries ? "Primaries on file" : "No primaries on file"]
        : [`Primaries ${subject.race.year}`]
  const [href, setHref] = React.useState("https://gov.nysgpt.com/simulator")
  React.useEffect(() => setHref(`https://gov.nysgpt.com/simulator${window.location.search}`), [subject, rule, pool])
  const caseIndex = cases.findIndex((c) => JSON.stringify(c.subject) === JSON.stringify(subject))
  const stepCase = (by: 1 | -1) => {
    const c = cases[(caseIndex + by + cases.length) % cases.length]
    if (c) open(c.subject, c.preset)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // The chamber's years with both district results and primaries on file, for the Sessions menu.
  const sessionYears =
    subject?.kind === "chamber"
      ? (subject.chamber.st === "US" ? house.map((h) => h.year) : chambers.filter((c) => c.state === subject.chamber.st && c.office === subject.chamber.office).map((c) => c.year)).filter((y) => primariesFor(years, subject.chamber.office, y)).sort((a, b) => b - a)
      : []

  // The rail's contents: the sections as the headings print them, Chart, the reading, Files and Case study under Summary.
  const anchor = (t: string) => `#${t.trim().replace(/\s+/g, "-").replace(/'/g, "").replace(/\?/g, "").toLowerCase()}`
  const toc = [
    { title: "Summary", url: "#summary", depth: 2 },
    { title: "Chart", url: "#chart", depth: 3 },
    ...(reading ? [{ title: reading.title, url: anchor(reading.title), depth: 3 }] : []),
    { title: "Files", url: "#files", depth: 3 },
    { title: "Case study", url: "#case-study", depth: 3 },
  ]

  const steps: TourStep[] =
    subject?.kind === "chamber"
      ? [
          { target: "sentence", text: "Every view opens on a claim, then lets you test it. This one: the chamber looks like a set of seats decided by voters in November.", before: () => setRule("all") },
          { target: "ring", text: "One dot per seat, blue from the left and red from the right, the closest races at the seam. Every seat filled in: the chamber as it looks.", pad: 16 },
          { target: "rules", text: "Press Closed. Most seats fade: they were settled before November, in a closed party primary. That is the claim being tested.", pad: 12, before: () => setRule("held") },
          { target: "rules", text: "Now open the primaries. Top two advancing moves settled seats back to November, where all voters choose between two candidates of one party. Top four moves more.", pad: 12, before: () => setRule(subject.chamber.primaries ? "top2" : "held") },
          { target: "counts", text: "Solid seats were decided in the general election. Pale seats were settled in the primary. Click any seat for its race and, under an open rule, its November ballot.", pad: 12 },
          { target: "cases", text: "Each case is a claim of its own, opened already set up: a ranked-choice count where the head-to-head winner lost, a primary that would have sent two Democrats to November.", pad: 12 },
        ]
      : subject?.kind === "rcv"
        ? [
            { target: "sentence", text: "The claim: who won, and whether the count agrees with the head-to-head result." },
            { target: "ring", text: "Each row is a round. The eliminated candidate's ballots flow as ribbons into the next row. The tick on every row is a majority.", pad: 16 },
            { target: "rules", text: "The lever. Take a candidate out and the count runs again from the same ballots.", pad: 12 },
            { target: "reading", text: "One on one: the share of ballots ranking each candidate above each rival. Green cells are wins.", pad: 12 },
            { target: "cases", text: "The cases open other claims already set up.", pad: 12 },
          ]
        : [
            { target: "sentence", text: "The claim: who the two party primaries sent to November, and who one open primary would have sent." },
            { target: "rules", text: "Pool the primaries and watch the candidates re-sort into one list, with the advancing line drawn across it.", pad: 12, before: () => setPool("two") },
            { target: "reading", text: "November under that rule, with the real general vote where one was counted.", pad: 12 },
            { target: "cases", text: "The cases open other claims already set up.", pad: 12 },
          ]

  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full" style={{ "--party-d": PARTY_COLORS.D, "--party-r": PARTY_COLORS.R } as React.CSSProperties}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
      <RecordHeader
        media={<FlagChip state={flag} width={Math.round(RECORD_MEDIA * 1.5)} className="rounded-lg" />}
        title={title}
        meta={meta}
        action={
          <>
            <DocsCopyPage
              page={`# ${title}\n\n${meta.join(" · ")}`}
              url={href}
              menu={[
                <button key="tour" type="button" onClick={() => setTour(true)}>
                  Page tour
                </button>,
                <Link key="map" href="/simulator/map">
                  Map
                </Link>,
              ]}
            />
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="icon" className="extend-touch-target size-8 shadow-none md:size-7" onClick={() => stepCase(-1)} aria-label="Previous case">
                <IconArrowLeft />
              </Button>
              <Button variant="secondary" size="icon" className="extend-touch-target size-8 shadow-none md:size-7" onClick={() => stepCase(1)} aria-label="Next case">
                <IconArrowRight />
              </Button>
            </div>
          </>
        }
      />
      <hr className="border-0 border-t border-border" />
      <div className="typeset w-full flex-1">
        {/* The record pages' order: h2 Summary and its claim, h3 Chart under it, then h2 Files and h2 Case study as sections of their own, each behind a rule (Brendan, 2026-09-17). */}
        <H2>Summary</H2>
        <p data-tour="sentence">{sentence}</p>
        <H3>Chart</H3>
        <PreviewFrame>
          {subject?.kind === "chamber" && (
            <Chamber
              subject={subject.chamber}
              rule={rule}
              onRule={setRule}
              years={sessionYears}
              onYear={(y) => {
                const s = chamberSubject(subject.chamber.st, subject.chamber.office, y)
                if (s) open({ kind: "chamber", chamber: s }, { rule: rule === "all" ? "held" : rule })
              }}
              renderSentence={renderSentence}
              renderReading={renderReading}
            />
          )}
          {subject?.kind === "rcv" && <RankedChoice contest={subject.contest} removed={removed} onRemoved={setRemoved} renderSentence={renderSentence} renderReading={renderReading} />}
          {subject?.kind === "race" && <TopTwo subject={subject.race} pool={pool} onPool={setPool} renderSentence={renderSentence} renderReading={renderReading} />}
        </PreviewFrame>
        {reading && (
          <>
            <H3>{reading.title}</H3>
            <div data-not-typeset="true" data-tour="reading">
              {reading.body}
            </div>
          </>
        )}
        <H3>Files</H3>
        <div className="mb-12" data-not-typeset="true">
          <Browse contests={contests} years={years} house={house} chambers={chambers} chamberSubject={chamberSubject} onOpen={(s, p) => open(s, p)} />
        </div>
        <H3>Case study</H3>
        <ul className="mt-4 grid list-none grid-cols-6 gap-3 p-0" data-not-typeset="true" data-tour="cases">
          {cases.map((c, i) => (
            <li key={c.title} className={cn("m-0 p-0", i < 3 ? "col-span-3 sm:col-span-2" : "col-span-3")}>
              <button type="button" onClick={() => open(c.subject, c.preset)} aria-current={i === caseIndex ? "true" : undefined} className="flex h-full w-full flex-col gap-1.5 rounded-xl border px-3.5 py-3 text-left hover:bg-muted aria-[current=true]:bg-muted">
                <FlagChip state={c.state} width={20} />
                <span className="text-sm leading-tight font-semibold text-balance">{c.title}</span>
                <span className="text-xs text-muted-foreground">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {tour && <Tour steps={steps} onDone={() => setTour(false)} />}
        </div>
      </div>
      <RightRailSheet>
        <DocsTableOfContents toc={toc} />
        <PublicRail />
      </RightRailSheet>
    </div>
  )
}

const TABLE = "w-full border-collapse text-sm [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground"

/** Everything on file, three tables behind three tabs: chambers by state, ranked-choice contests by name, a year's primaries by state. */
function Browse({
  contests,
  years,
  house,
  chambers,
  chamberSubject,
  onOpen,
}: {
  contests: ContestSummary[]
  years: TopTwoYear[]
  house: HouseView[]
  chambers: ChamberView[]
  chamberSubject: (st: string, office: string, year: number) => ChamberSubject | null
  onOpen: (s: Subject, preset: Preset) => void
}) {
  const [raceYear, setRaceYear] = React.useState<number>(years[0]?.year ?? 2022)
  const [races, setRaces] = React.useState<PrimaryRace[] | null>(null)
  const [raceState, setRaceState] = React.useState("")
  const rows = React.useMemo(() => {
    const out: { st: string; office: string; years: number[] }[] = [{ st: "US", office: "US HOUSE", years: house.map((h) => h.year) }]
    const seen = new Map<string, number[]>()
    for (const c of chambers) {
      const k = `${c.state}|${c.office}`
      seen.set(k, [...(seen.get(k) ?? []), c.year])
    }
    for (const [k, ys] of [...seen].sort((a, b) => stateName(a[0].split("|")[0]).localeCompare(stateName(b[0].split("|")[0])) || a[0].localeCompare(b[0]))) {
      const [st, office] = k.split("|")
      out.push({ st, office, years: ys.sort((a, b) => b - a) })
    }
    return out
  }, [house, chambers])
  const shown = contests
  React.useEffect(() => {
    const y = years.find((x) => x.year === raceYear)
    if (!y) return
    let live = true
    setRaces(null)
    fetch(y.url)
      .then((r) => r.json() as Promise<{ races: PrimaryRace[] }>)
      .then((b) => live && setRaces(b.races))
      .catch(() => live && setRaces([]))
    return () => {
      live = false
    }
  }, [raceYear, years])
  const raceStates = [...new Set((races ?? []).map((r) => r.state))].sort((a, b) => stateName(a).localeCompare(stateName(b)))
  const st = raceState || raceStates[0] || ""
  const raceList = (races ?? []).filter((r) => r.state === st).sort((a, b) => a.office.localeCompare(b.office) || a.district.localeCompare(b.district, undefined, { numeric: true }))
  const y = years.find((x) => x.year === raceYear)
  return (
    <Tabs defaultValue="chambers" className="mt-3 gap-0">
      <TabsList>
        <TabsTrigger value="chambers">Chambers</TabsTrigger>
        <TabsTrigger value="rcv">Ranked choice</TabsTrigger>
        <TabsTrigger value="primaries">Primaries</TabsTrigger>
      </TabsList>
      <TabsContents>
        <TabsContent value="chambers">
          <div className="mt-3 max-h-[300px] overflow-y-auto rounded-xl border">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Chamber</th>
                  <th>Years on file</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.st}|${r.office}`}>
                    <td className="whitespace-nowrap">
                      <FlagChip state={r.st} width={18} className="mr-2 inline-block align-[-2px]" />
                      {r.st === "US" ? "United States" : (STATE_NAMES[r.st] ?? r.st)}
                    </td>
                    <td className="whitespace-nowrap">{r.st === "US" ? "House" : r.office === "STATE SENATE" ? "Senate" : "House"}</td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {r.years.map((yy) => (
                          <button
                            key={yy}
                            type="button"
                            onClick={() => {
                              const s = chamberSubject(r.st, r.office, yy)
                              if (s) onOpen({ kind: "chamber", chamber: s }, { rule: "held" })
                            }}
                            className="rounded-md border px-1.5 py-0.5 text-xs tabular-nums hover:bg-muted"
                          >
                            {yy}
                          </button>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="rcv">
          <div className="mt-3 max-h-[300px] overflow-y-auto rounded-xl border">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>Contest</th>
                  <th>Date</th>
                  <th className="text-right!">Ballots</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-muted" onClick={() => onOpen({ kind: "rcv", contest: c }, {})}>
                    <td>{c.title}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{longDate(c.date)}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{number.format(c.ballots)}</td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={3} className="text-muted-foreground">
                      No contest matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="primaries">
          <div className="mt-3 flex gap-2">
            <NativeSelect value={String(raceYear)} onChange={(e) => setRaceYear(Number(e.target.value))} aria-label="Year">
              {years.map((yy) => (
                <NativeSelectOption key={yy.year} value={String(yy.year)}>
                  {yy.year}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect value={st} onChange={(e) => setRaceState(e.target.value)} aria-label="State">
              {raceStates.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {STATE_NAMES[s] ?? s}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="mt-3 max-h-[300px] overflow-y-auto rounded-xl border">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>Race</th>
                  <th>Primaries</th>
                </tr>
              </thead>
              <tbody>
                {races === null && (
                  <tr>
                    <td colSpan={2} className="text-muted-foreground">
                      Reading the {raceYear} primaries…
                    </td>
                  </tr>
                )}
                {raceList.map((r) => (
                  <tr key={`${r.state}-${r.office}-${r.district}-${r.label}`} className="cursor-pointer hover:bg-muted" onClick={() => y && onOpen({ kind: "race", race: { year: r.year, state: r.state, office: r.office, district: r.district, url: y.url } }, { pool: r.complete && r.system === "party primaries" ? "two" : "run" })}>
                    <td>{raceName(r)}</td>
                    <td className="text-muted-foreground">{r.system !== "party primaries" ? r.system : r.complete ? (r.same_party ? "same-party top two" : "counted") : "not counted"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </TabsContents>
    </Tabs>
  )
}
