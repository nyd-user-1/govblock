"use client"

import Link from "next/link"
import * as React from "react"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { Button } from "@govblock/ui/components/ny4/button"
import { NativeSelect, NativeSelectOption } from "@govblock/ui/components/native-select"
import { cn } from "@govblock/ui/lib/utils"

import { PublicRail } from "@/components/block-card"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { Chamber, type ChamberRule, type ChamberSubject, type Reading } from "@/components/elections/chamber"
import { RankedChoice, type ContestSummary } from "@/components/elections/ranked-choice"
import { TopTwo, raceName, type Pool, type RaceSubject, type TopTwoYear } from "@/components/elections/top-two"
import { Tour, type TourStep } from "@/components/elections/tour"
import { FlagChip } from "@/components/policy/imagery"
import { PreviewFrame } from "@/components/preview-frame"
import { RightRailSheet } from "@/components/rail-sheet"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { H2, H3 } from "@/components/typeset"
import { chamberName, type PrimaryRace } from "@/lib/elections/seats"
import { STATE_NAMES, stateName } from "@/lib/filters"
import { PARTY_COLORS } from "@/lib/map/palette"

// /simulator. Three pairs, each a chart over the table of everything it can
// open (Brendan, 2026-09-17): a chamber's seats by where they were decided
// and the open-primary rules that move them, over the chambers whose
// primary results are on file; a ranked-choice contest replayed from its
// ballots, over the 607 contests; a race's party primaries pooled into one,
// over the year's races. Every chart opens on a claim. The case studies at
// the foot set one of the three up on a real story. The page carries three
// small lists and reads nothing else on load; a chamber's results, a
// contest's ballots or a year's primaries arrive when picked.

export type HouseView = { year: number; congress: number; results: string }
export type ChamberView = { year: number; state: string; office: "STATE HOUSE" | "STATE SENATE"; results: string }

type Case = { title: string; hint: string; state: string; pair: "chamber" | "rcv" | "race"; chamber?: ChamberSubject; rule?: ChamberRule; contest?: ContestSummary; race?: RaceSubject; pool?: Pool }

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const longDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`
const number = new Intl.NumberFormat("en-US")
const TABLE = "w-full border-collapse text-sm [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground"

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
  const y22 = years.find((y) => y.year === 2022)
  const cases = React.useMemo<Case[]>(() => {
    const out: Case[] = []
    const h22 = chamberSubject("US", "US HOUSE", 2022)
    if (h22) out.push({ title: "288 decided in the Primary", hint: "U.S. House 2022", state: "US", pair: "chamber", chamber: h22, rule: "held" })
    const ak = contests.find((c) => c.id === "alaska-2022-08-16-us-house-special")
    if (ak) out.push({ title: "Begich beat everyone one on one. He finished third.", hint: "Alaska special election 2022", state: "AK", pair: "rcv", contest: ak })
    const wi = chamberSubject("WI", "STATE HOUSE", 2024)
    if (wi) out.push({ title: "64 of 99 Wisconsin Assembly seats were settled before November", hint: "Wisconsin Assembly 2024", state: "WI", pair: "chamber", chamber: wi, rule: "held" })
    if (y22) out.push({ title: "Two Democrats would have met in November", hint: "Texas 28th, 2022", state: "TX", pair: "race", race: { year: 2022, state: "TX", office: "US HOUSE", district: "28", url: y22.url }, pool: "two" })
    const bu = contests.find((c) => c.id === "burlington-2009-03-03-mayor")
    if (bu) out.push({ title: "Kiss won. Montroll beat him one on one.", hint: "Burlington mayor 2009", state: "VT", pair: "rcv", contest: bu })
    return out
  }, [contests, chamberSubject, y22])

  // The three pairs' subjects, each with its own lever and claim.
  const [chamber, setChamber] = React.useState<ChamberSubject | null>(null)
  const [rule, setRule] = React.useState<ChamberRule>("all")
  const [contest, setContest] = React.useState<ContestSummary | null>(null)
  const [removed, setRemoved] = React.useState<ReadonlySet<number>>(new Set())
  const [race, setRace] = React.useState<RaceSubject | null>(null)
  const [pool, setPool] = React.useState<Pool>("run")
  const [sentences, setSentences] = React.useState<Record<"chamber" | "rcv" | "race", React.ReactNode>>({ chamber: null, rcv: null, race: null })
  const [reading, setReading] = React.useState<Reading>(null)
  const [tour, setTour] = React.useState(false)
  const [caseIndex, setCaseIndex] = React.useState(0)
  const say = React.useMemo(
    () => ({
      chamber: (node: React.ReactNode) => setSentences((s) => ({ ...s, chamber: node })),
      rcv: (node: React.ReactNode) => setSentences((s) => ({ ...s, rcv: node })),
      race: (node: React.ReactNode) => setSentences((s) => ({ ...s, race: node })),
    }),
    []
  )
  const renderReading = React.useCallback((r: Reading) => setReading(r), [])
  const noReading = React.useCallback(() => {}, [])

  const setUrl = React.useCallback((k: string, v: string | null) => {
    const url = new URL(window.location.href)
    if (v) url.searchParams.set(k, v)
    else url.searchParams.delete(k)
    window.history.replaceState(null, "", url)
  }, [])
  const openChamber = React.useCallback(
    (s: ChamberSubject, r: ChamberRule = "all") => {
      setChamber(s)
      setRule(r)
      setUrl("chamber", `${s.st}|${s.office}|${s.year}`)
      setUrl("rule", r === "all" ? null : r)
    },
    [setUrl]
  )
  const openContest = React.useCallback(
    (c: ContestSummary) => {
      setContest(c)
      setRemoved(new Set())
      setUrl("c", c.id)
    },
    [setUrl]
  )
  const openRace = React.useCallback(
    (r: RaceSubject, p: Pool = "run") => {
      setRace(r)
      setPool(p)
      setUrl("race", `${r.year}|${r.state}|${r.office}|${r.district}`)
      setUrl("pool", p === "run" ? null : p)
    },
    [setUrl]
  )
  const openCase = (c: Case, i: number) => {
    setCaseIndex(i)
    if (c.pair === "chamber" && c.chamber) openChamber(c.chamber, c.rule)
    if (c.pair === "rcv" && c.contest) openContest(c.contest)
    if (c.pair === "race" && c.race) openRace(c.race, c.pool)
    document.getElementById(c.pair === "chamber" ? "chambers" : c.pair === "rcv" ? "ranked-choice" : "primaries")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // A shared link names its subjects; otherwise each pair opens on its first case.
  React.useEffect(() => {
    const q = new URL(window.location.href).searchParams
    const ch = q.get("chamber")?.split("|")
    const s = ch?.length === 3 ? chamberSubject(ch[0], ch[1], Number(ch[2])) : null
    if (s) openChamber(s, (q.get("rule") as ChamberRule) || "all")
    else if (cases[0]?.chamber) openChamber(cases[0].chamber)
    const named = contests.find((x) => x.id === q.get("c"))
    if (named) openContest(named)
    else if (cases[1]?.contest) openContest(cases[1].contest)
    const ra = q.get("race")?.split("|")
    const yr = ra?.length === 4 ? years.find((x) => x.year === Number(ra[0])) : null
    if (ra && yr) openRace({ year: Number(ra[0]), state: ra[1], office: ra[2], district: ra[3], url: yr.url }, (q.get("pool") as Pool) || "run")
    else if (cases[3]?.race) openRace(cases[3].race)
    // The first paint reads the address once; the openers are stable.
  }, [cases, chamberSubject, contests, years, openChamber, openContest, openRace])

  React.useEffect(() => {
    if (!localStorage.getItem("simulator-tour")) {
      localStorage.setItem("simulator-tour", "1")
      const t = setTimeout(() => setTour(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  const [href, setHref] = React.useState("https://gov.nysgpt.com/simulator")
  React.useEffect(() => setHref(`https://gov.nysgpt.com/simulator${window.location.search}`), [chamber, rule, contest, race, pool])
  const stepCase = (by: 1 | -1) => {
    const i = (caseIndex + by + cases.length) % cases.length
    if (cases[i]) openCase(cases[i], i)
  }
  const sessionYears = chamber ? (chamber.st === "US" ? house.map((h) => h.year) : chambers.filter((c) => c.state === chamber.st && c.office === chamber.office).map((c) => c.year)).filter((y) => primariesFor(years, chamber.office, y)).sort((a, b) => b - a) : []

  const toc = [
    { title: "Summary", url: "#summary", depth: 2 },
    { title: "Chambers", url: "#chambers", depth: 3 },
    { title: "Ranked choice", url: "#ranked-choice", depth: 3 },
    { title: "Primaries", url: "#primaries", depth: 3 },
    { title: "Case study", url: "#case-study", depth: 3 },
  ]
  const steps: TourStep[] = [
    { target: "chamber-sentence", text: "Every chart opens on a claim, then lets you test it. This one: the chamber looks like seats decided by voters in November." },
    { target: "chamber-ring", text: "One dot per seat, blue from the left and red from the right, the closest races at the seam.", pad: 16 },
    { target: "chamber-rules", text: "Press Closed and most seats fade: they were settled before November, in a closed party primary. Then open the primaries, top two or top four advancing, and watch settled seats move back to November.", pad: 12, before: () => setRule("held") },
    { target: "rcv-ring", text: "A ranked-choice contest replayed from its ballots: each bar a round, the eliminated candidate's ballots flowing into the next. Take a candidate out and the count runs again.", pad: 16 },
    { target: "race-ring", text: "A race's party primaries, then the same candidates pooled into one open primary with the advancing line across it.", pad: 16 },
    { target: "cases", text: "The case studies set one of the three up on a real story.", pad: 12 },
  ]

  const chamberTitle = chamber ? (chamber.st === "US" ? "U.S. House" : `${STATE_NAMES[chamber.st] ?? chamber.st} ${chamberName(chamber.st, chamber.office)}`) : ""

  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full" style={{ "--party-d": PARTY_COLORS.D, "--party-r": PARTY_COLORS.R } as React.CSSProperties}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <RecordHeader
            media={<FlagChip state="US" width={Math.round(RECORD_MEDIA * 1.5)} className="rounded-lg" />}
            title="Open Primary Simulator"
            meta={["Every chamber, contest and primary on file"]}
            action={
              <>
                <DocsCopyPage
                  page={`# Open Primary Simulator\n\n${href}`}
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
            {/* h2 Summary, then the three pairs and the case studies as h3 sub-sections; each pair is a claim, its chart, and the table of what it can open. */}
            <H2>Summary</H2>
            <p>
              Most seats in Congress and the statehouses are settled before November, in a party primary. In the 2022 U.S. House, <code>288</code> of <code>435</code> were, in primaries that <code>19.8 million</code> people voted in: <code>8%</code> of voting-age citizens. The three charts below test what one open primary, and a ranked-choice count, would have changed, from the real votes.
            </p>

            <H3>Chambers</H3>
            <p data-tour="chamber-sentence">
              {chamber && (
                <>
                  <FlagChip state={chamber.st} width={18} className="mr-1.5 inline-block align-[-3px]" />
                  <b>{chamberTitle}</b>, {chamber.year}.{" "}
                </>
              )}
              {sentences.chamber}
            </p>
            <div data-tour="chamber-ring">
              <PreviewFrame>
                {chamber && (
                  <Chamber
                    subject={chamber}
                    rule={rule}
                    onRule={setRule}
                    years={sessionYears}
                    onYear={(y) => {
                      const s = chamberSubject(chamber.st, chamber.office, y)
                      if (s) openChamber(s, rule)
                    }}
                    renderSentence={say.chamber}
                    renderReading={renderReading}
                  />
                )}
              </PreviewFrame>
            </div>
            {reading && (
              <div className="-mt-8 mb-12" data-not-typeset="true">
                <div className="mb-2 text-[11px] tracking-wider text-muted-foreground uppercase">{reading.title}</div>
                {reading.body}
              </div>
            )}
            <div data-not-typeset="true" className="mb-12">
              <ChambersTable
                house={house}
                chambers={chambers}
                years={years}
                current={chamber}
                onOpen={(st, office, y) => {
                  const s = chamberSubject(st, office, y)
                  if (s) openChamber(s, "all")
                }}
              />
            </div>

            <H3>Ranked choice</H3>
            <p>
              {contest && (
                <>
                  <FlagChip state={contest.state} width={18} className="mr-1.5 inline-block align-[-3px]" />
                  <b>{contest.title}</b>, {number.format(contest.ballots)} ballots.{" "}
                </>
              )}
              {sentences.rcv}
            </p>
            <div data-tour="rcv-ring">
              <PreviewFrame>{contest && <RankedChoice contest={contest} removed={removed} onRemoved={setRemoved} renderSentence={say.rcv} renderReading={noReading} />}</PreviewFrame>
            </div>
            <div data-not-typeset="true" className="mb-12">
              <ContestsTable contests={contests} current={contest} onOpen={openContest} />
            </div>

            <H3>Primaries</H3>
            <p>
              {race && (
                <>
                  <FlagChip state={race.state} width={18} className="mr-1.5 inline-block align-[-3px]" />
                  <b>{raceName(race)}</b>.{" "}
                </>
              )}
              {sentences.race}
            </p>
            <div data-tour="race-ring">
              <PreviewFrame>{race && <TopTwo subject={race} pool={pool} onPool={setPool} renderSentence={say.race} renderReading={noReading} />}</PreviewFrame>
            </div>
            <div data-not-typeset="true" className="mb-12">
              <PrimariesTable years={years} current={race} onOpen={openRace} />
            </div>

            <H3>Case study</H3>
            <ul className="mt-4 grid list-none grid-cols-6 gap-3 p-0" data-not-typeset="true" data-tour="cases">
              {cases.map((c, i) => (
                <li key={c.title} className={cn("m-0 p-0", i < 3 ? "col-span-3 sm:col-span-2" : "col-span-3")}>
                  <button type="button" onClick={() => openCase(c, i)} aria-current={i === caseIndex ? "true" : undefined} className="flex h-full w-full flex-col gap-1.5 rounded-xl border px-3.5 py-3 text-left hover:bg-muted aria-[current=true]:bg-muted">
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

/** Every chamber-year whose primary results are on file, one row per state and chamber, the years as buttons. */
function ChambersTable({ house, chambers, years, current, onOpen }: { house: HouseView[]; chambers: ChamberView[]; years: TopTwoYear[]; current: ChamberSubject | null; onOpen: (st: string, office: string, year: number) => void }) {
  const rows = React.useMemo(() => {
    const out: { st: string; office: string; years: number[] }[] = [{ st: "US", office: "US HOUSE", years: house.map((h) => h.year).filter((yy) => primariesFor(years, "US HOUSE", yy)) }]
    const seen = new Map<string, number[]>()
    for (const c of chambers) {
      if (!primariesFor(years, c.office, c.year)) continue
      const k = `${c.state}|${c.office}`
      seen.set(k, [...(seen.get(k) ?? []), c.year])
    }
    for (const [k, ys] of [...seen].sort((a, b) => stateName(a[0].split("|")[0]).localeCompare(stateName(b[0].split("|")[0])) || a[0].localeCompare(b[0]))) {
      const [st, office] = k.split("|")
      out.push({ st, office, years: ys.sort((a, b) => b - a) })
    }
    return out
  }, [house, chambers, years])
  return (
    <div className="max-h-[300px] overflow-y-auto rounded-xl border">
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
                    <button key={yy} type="button" onClick={() => onOpen(r.st, r.office, yy)} aria-current={current?.st === r.st && current.office === r.office && current.year === yy ? "true" : undefined} className="rounded-md border px-1.5 py-0.5 text-xs tabular-nums hover:bg-muted aria-[current=true]:bg-muted">
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
  )
}

/** The 607 ranked-choice contests with their ballots on file. */
function ContestsTable({ contests, current, onOpen }: { contests: ContestSummary[]; current: ContestSummary | null; onOpen: (c: ContestSummary) => void }) {
  return (
    <div className="max-h-[300px] overflow-y-auto rounded-xl border">
      <table className={TABLE}>
        <thead>
          <tr>
            <th>Contest</th>
            <th>Date</th>
            <th className="text-right!">Ballots</th>
          </tr>
        </thead>
        <tbody>
          {contests.map((c) => (
            <tr key={c.id} className={cn("cursor-pointer hover:bg-muted", current?.id === c.id && "bg-muted")} onClick={() => onOpen(c)}>
              <td>{c.title}</td>
              <td className="whitespace-nowrap text-muted-foreground">{longDate(c.date)}</td>
              <td className="text-right text-muted-foreground tabular-nums">{number.format(c.ballots)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A year's races with their primaries on file, by state. */
function PrimariesTable({ years, current, onOpen }: { years: TopTwoYear[]; current: RaceSubject | null; onOpen: (r: RaceSubject, p: Pool) => void }) {
  const [raceYear, setRaceYear] = React.useState<number>(current?.year ?? years[0]?.year ?? 2022)
  const [races, setRaces] = React.useState<PrimaryRace[] | null>(null)
  const [raceState, setRaceState] = React.useState(current?.state ?? "")
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
  const st = raceStates.includes(raceState) ? raceState : (raceStates[0] ?? "")
  const list = (races ?? []).filter((r) => r.state === st).sort((a, b) => a.office.localeCompare(b.office) || a.district.localeCompare(b.district, undefined, { numeric: true }))
  const y = years.find((x) => x.year === raceYear)
  return (
    <>
      <div className="mb-3 flex gap-2">
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
      <div className="max-h-[300px] overflow-y-auto rounded-xl border">
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
            {list.map((r) => {
              const isCurrent = current?.year === r.year && current.state === r.state && current.office === r.office && String(Number(current.district)) === String(Number(r.district))
              return (
                <tr key={`${r.state}-${r.office}-${r.district}-${r.label}`} className={cn("cursor-pointer hover:bg-muted", isCurrent && "bg-muted")} onClick={() => y && onOpen({ year: r.year, state: r.state, office: r.office, district: r.district, url: y.url }, r.complete && r.system === "party primaries" ? "two" : "run")}>
                  <td>{raceName(r)}</td>
                  <td className="text-muted-foreground">{r.system !== "party primaries" ? r.system : r.complete ? (r.same_party ? "same-party top two" : "counted") : "not counted"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
