import "server-only"

import { n, q } from "@/lib/policy/db"

import type { ChartSpec } from "./chart-spec"

// Open primaries, traced (2026-09-17): the Clerk's open-primaries report of
// 2026-09-07 (lib/agents/featured.ts), made a trace. The bills are counted
// from the record every time the page is built, by a keyword match on titles
// and summaries; the thirteen enactments are the ones that report verified by
// hand, each read back from the record here. The 2024 ballot-measure money is
// not in the record, and says where it came from.

const SLUG = "open-primaries"

// Who may vote in a primary, as a title or summary words it.
const RX = `'(open|top[- ]two|top[- ]four|top[- ]five|nonpartisan|blanket|semi[- ]open|semi[- ]closed|closed|jungle|unaffiliated|independent)[^.]{0,40}primar|primar[^.]{0,40}(unaffiliated|independent voters|crossover|open to)'`

// The enactments, by jurisdiction, number and session — a number repeats across sessions.
const LAWS: { state: string; bill: string; session: string; note: string }[] = [
  { state: "CA", bill: "SCA4", session: "2009-2010 Regular Session", note: "Put the top-two primary to California's voters, who adopted it as Proposition 14 in 2010." },
  { state: "SD", bill: "HB1054", session: "2010 Regular Session", note: "Gave independent voters voting absentee the right ballot in a primary." },
  { state: "LA", bill: "HB292", session: "2010 Regular Session", note: "Moved Louisiana's congressional races to an open primary." },
  { state: "ID", bill: "H0351", session: "2011 Regular Session", note: "Rewrote primary administration after the courts let parties close their primaries." },
  { state: "MT", bill: "SB408", session: "2013 Regular Session", note: "Referred a top-two primary to the ballot." },
  { state: "KY", bill: "HB150", session: "2015 Regular Session", note: "An elections act touching primary participation." },
  { state: "LA", bill: "SCR55", session: "2020 Regular Session", note: "Created the Closed Party Primary Task Force, the first step back toward closed primaries." },
  { state: "ME", bill: "LD231", session: "2021-2022 Regular Session", note: "Let unenrolled voters vote in one party's primary, from 2024." },
  { state: "NJ", bill: "A3820", session: "2022-2023 Regular Session", note: "Stopped sending unaffiliated mail-in voters a primary ballot." },
  { state: "NJ", bill: "S3758", session: "2022-2023 Regular Session", note: "Moved the deadline for unaffiliated mail-in voters to declare a party." },
  { state: "NJ", bill: "A1486", session: "2024-2025 Regular Session", note: "The same deadline change, in the Assembly's version." },
  { state: "NM", bill: "SB16", session: "2025 Regular Session", note: "Let voters who decline a party vote in one major party's primary, from 2026." },
  { state: "ME", bill: "LD390", session: "2025-2026 Regular Session", note: "Set a primary-election period for unenrolled candidates' contributions." },
]

export const OPEN_PRIMARIES_SOURCES = [
  { title: "The Clerk's open-primaries report, 2026-09-07", url: "/reports/open-primaries-2026-09-07.pdf" },
  { title: "OpenSecrets via IVN: more than $400 million raised on 2024 ballot measures", url: "https://ivn.us/posts/more-400-million-raised-2024-ballot-measures-opensecrets-reports-2024-10-31" },
  { title: "Sentinel Colorado: Prop 131 and the national push against partisan primaries", url: "https://sentinelcolorado.com/nation-world/prop-131-part-of-a-national-push-to-ease-polarization-by-ditching-partisan-primaries/" },
  { title: "The Nevada Independent: Question 3's out-of-state money", url: "https://thenevadaindependent.com/article/question-3-backers-promote-ranked-choice-voting-with-major-out-of-state-money" },
  { title: "Colorado Newsline: the Proposition 131 debate", url: "https://coloradonewsline.com/2024/10/25/colorado-proposition-131-debate/" },
  { title: "Alaska Beacon: the repeal effort outraised a hundredfold", url: "https://alaskabeacon.com/briefs/alaska-ranked-choice-voting-repeal-effort-outraised-a-hundredfold-campaign-finance-filings-show/" },
  { title: "congress.gov: H.R. 155, the Let America Vote Act", url: "https://www.congress.gov/bill/119th-congress/house-bill/155" },
]

export async function openPrimariesStudy() {
  // One pass over the bills: the keyword match is a full scan, so it runs once
  // and the counts are made here.
  const [matched, laws, federal] = await Promise.all([
    q<{ state: string; year: number | null }>(`
      select state, substring(session_title from '(\\d{4})')::int as year from "Bills" where title ~* ${RX} or description ~* ${RX}`),
    q<{ bill_id: number; state: string; bill_number: string; session_title: string; status_desc: string; status_date: string; title: string }>(`
      select bill_id, state, bill_number, session_title, status_desc, status_date::text, title from "Bills"
       where (state, bill_number, session_title) in (${LAWS.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ")})`,
      LAWS.flatMap((l) => [l.state, l.bill, l.session])
    ),
    q<{ key: string; title: string; introduced_date: string; latest_action: string; latest_action_date: string; sponsor_name: string }>(
      `select key, coalesce(popular_title, display_title) as title, introduced_date, latest_action, latest_action_date, sponsor_name from congress_bills where key = '119-HR-155'`
    ),
  ])

  const byYear = new Map<number, { bills: number; states: Set<string> }>()
  const byStateCount = new Map<string, number>()
  for (const row of matched) {
    byStateCount.set(row.state, (byStateCount.get(row.state) ?? 0) + 1)
    const year = row.year === null ? null : n(row.year)
    if (!year) continue
    const entry = byYear.get(year) ?? { bills: 0, states: new Set<string>() }
    entry.bills++
    entry.states.add(row.state)
    byYear.set(year, entry)
  }
  const years = [...byYear].sort((x, y) => x[0] - y[0]).map(([year, e]) => ({ year, bills: e.bills, states: e.states.size }))
  const totals = [{ bills: matched.length, states: byStateCount.size }]
  const byState = [...byStateCount].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([state, bills]) => ({ state, bills }))

  const enacted = LAWS.map((l) => {
    const row = laws.find((r) => r.state === l.state && r.bill_number === l.bill && r.session_title === l.session)
    return { ...l, billId: row ? n(row.bill_id) : null, status: row?.status_desc ?? null, date: row?.status_date?.slice(0, 10) ?? null, title: row?.title ?? null }
  }).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  const lawYears = new Set(enacted.map((l) => l.date?.slice(0, 4)))

  const charts: ChartSpec[] = [
    {
      id: "open-primaries-bills",
      report: SLUG,
      kind: "columns",
      title: "Bills on who may vote in a primary, by session year",
      source: "The GovBlock record, all 50 states, D.C. and Congress; titles and summaries matched on primary-rule terms.",
      format: "int",
      columns: years.filter((y) => n(y.year) >= 2009).map((y) => ({ label: String(y.year), value: n(y.bills), highlight: lawYears.has(String(y.year)), note: `${n(y.states)} jurisdictions` })),
      highlightLabel: "A year one became law",
    },
  ]

  return {
    bills: n(totals[0]?.bills),
    states: n(totals[0]?.states),
    years: years.map((y) => ({ year: n(y.year), bills: n(y.bills), states: n(y.states) })),
    busiest: byState.map((s) => ({ state: s.state, bills: n(s.bills) })),
    enacted,
    federal: federal[0] ?? null,
    charts,
  }
}
