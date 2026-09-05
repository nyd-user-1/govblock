"use client"

import * as React from "react"


import CODES from "@/lib/data/congress/committee-codes.json"
import { fmtDate, fmtNumber } from "@/lib/format"
import { committeeKey } from "@/lib/policy/congress"
import type { RollCall } from "@/lib/policy/types"
import { useCongress, useCongressRecord } from "@/lib/policy/use-congress"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { FileBlock } from "@/components/file-block"
import { ChamberSeal } from "@/components/policy/imagery"
import { ActionTable, type ActionTableRow } from "@/components/policy/bill-tables"
import { CardBlock } from "@/components/policy/card-block"
import { PreviewFrame } from "@/components/preview-frame"
import { H2, H3 } from "@/components/typeset"
import { cn } from "@govblock/ui/lib/utils"

// The depth congress.gov shows on a bill and we did not: where the bill got to,
// every action with the stage and the roll call it produced, the committees that
// touched it, what it is about, what it costs, and who wrote it.
//
// A section of the page in the page's own voice — an H2, a Table or a list, and
// an honest sentence when we have nothing. Every one of these renders when empty
// and says what *we* lack, never what the bill lacks.

export type Action = {
  actionDate?: string | null
  actionTime?: string | null
  text?: string | null
  type?: string | null
  actionCode?: string | null
  sourceSystem?: { code?: string | null; name?: string | null } | null
  committees?: { systemCode?: string | null; name?: string | null }[]
  recordedVotes?: {
    rollNumber?: string | null
    chamber?: string | null
    url?: string | null
    sessionNumber?: string | null
    date?: string | null
  }[]
}

export type CboEstimate = { pubDate?: string | null; title?: string | null; url: string; description?: string | null }

export type BillRecord = {
  type?: string
  number?: string
  title?: string
  displayTitle?: string | null
  popularTitle?: string | null
  originChamber?: string | null
  introducedDate?: string | null
  constitutionalAuthorityStatementText?: string | null
  notes?: { text?: string | null; links?: { name?: string | null; url: string }[] }[]
  sponsors?: {
    bioguideId?: string | null
    fullName?: string | null
    party?: string | null
    state?: string | null
    district?: string | null
    isByRequest?: string | null
  }[]
  sponsorPeopleId?: number | null
  laws?: { type?: string | null; number?: string | null }[]
}

type Depth = {
  billId: number
  onCongress: boolean
  actions: Action[]
  actionTotal: number
  record: BillRecord | null
  committees: BillCommittee[]
  policyArea: string | null
  subjects: string[]
  cbo: CboEstimate[]
  policyAreas: string[]
}

const Ctx = React.createContext<Depth | null>(null)
const use = () => React.useContext(Ctx)

/** For the rail, which names the sections a bill actually has. */
export const useBillDepth = () => React.useContext(Ctx)

/** What the page fetched on the server, so the first render holds it. */
export type DepthInitial = {
  actions?: { count: number; actions: Action[] } | null
  record?: BillRecord | null
  committees?: BillCommittee[] | null
  subjects?: { policyArea?: { name?: string } | null; legislativeSubjects?: { name?: string }[] } | null
  cbo?: CboEstimate[] | null
  /** CRS's whole policy-area vocabulary, for the Classification section. */
  policyAreas?: string[] | null
}

export function BillDepthProvider({
  billId,
  state,
  initial,
  children,
}: {
  billId: number
  state: string
  /** Rows the page already fetched; a family handed in is not fetched again
      in the browser, so the block renders on the server and never pops in
      (2026-09-05). A family left out reads as it always did. */
  initial?: DepthInitial
  children: React.ReactNode
}) {
  const bill = String(billId)
  const scope = React.useMemo(() => ({ param: "bill", value: bill }), [bill])
  const on = state === "US"
  const held = <T,>(rows: T[] | null | undefined) => (rows && rows.length ? rows : null)

  const heldActions = held(initial?.actions?.actions)
  const actions = useCongress<Action>(heldActions ? null : "actions", "actions", scope, { bill, limit: 500 }, undefined, state)
  // One row rather than a family. The scope is still checked: an answer that
  // does not name this bill is not this bill's record, whatever it holds.
  const record = useCongressRecord<{ bill?: number; record?: BillRecord | null }>(
    initial?.record ? null : "bill-record",
    { bill },
    (answer) => String(answer?.bill ?? "") === bill && !!answer?.record,
    state
  )

  const heldCommittees = held(initial?.committees)
  const committees = useCongress<BillCommittee>(heldCommittees ? null : "bill-committees", "committees", scope, { bill }, undefined, state)
  const heldCbo = held(initial?.cbo)
  const cbo = useCongress<CboEstimate>(heldCbo ? null : "cbo-estimates", "cboCostEstimates", scope, { bill }, undefined, state)
  // Subjects come back in the API's own nesting — a policy area beside a list —
  // so the envelope is read whole rather than as a family of rows.
  const heldSubjects = initial?.subjects && (initial.subjects.policyArea || initial.subjects.legislativeSubjects?.length) ? initial.subjects : null
  const subjects = useCongressRecord<{ bill?: number; subjects?: { policyArea?: { name?: string } | null; legislativeSubjects?: { name?: string }[] } }>(
    heldSubjects ? null : "bill-subjects",
    { bill },
    (answer) => String(answer?.bill ?? "") === bill,
    state
  )

  const value = React.useMemo<Depth>(() => {
    const subjectRows = heldSubjects ?? subjects?.subjects
    return {
      billId,
      onCongress: on,
      actions: heldActions ?? actions.rows,
      actionTotal: heldActions ? (initial?.actions?.count ?? heldActions.length) : actions.count,
      record: initial?.record ?? record?.record ?? null,
      committees: heldCommittees ?? committees.rows,
      policyArea: subjectRows?.policyArea?.name ?? null,
      subjects: (subjectRows?.legislativeSubjects ?? []).map((row) => row.name ?? "").filter(Boolean),
      cbo: heldCbo ?? cbo.rows,
      policyAreas: initial?.policyAreas ?? [],
    }
  }, [billId, on, initial, heldActions, heldCommittees, heldCbo, heldSubjects, actions.rows, actions.count, record, committees.rows, subjects, cbo.rows])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---- the tracker ---------------------------------------------------------- */

/**
 * congress.gov's Status of Legislation, derived the way congress.gov derives
 * it: from the Library of Congress action codes, which are the numeric ones on
 * actions whose `sourceSystem` is the Library itself. The chamber codes
 * (H37100, H8D000…) describe procedure; these describe *stage*, which is why
 * they and not the text are the mapping.
 *
 *   1000 · 1025   Introduced in House      →  Introduced
 *   10000 · 10025 Introduced in Senate     →  Introduced
 *   8000          Passed/agreed to in House →  Passed House
 *   17000         Passed/agreed to in Senate → Passed Senate
 *   28000 · E20000 Presented to President   →  To President
 *   36000 · E40000 Became Public/Private Law → Became Law
 *
 * Conference and Vetoed have no single code and are taken from the action's
 * `type`, which BILLSTATUS publishes for every action. congress.gov labels the
 * conference step "Resolving Differences", since a difference can also be
 * settled by amendment exchange; Brendan chose "Conference" (2026-09-05).
 */
const STAGE_BY_CODE: Record<string, string> = {
  "1000": "Introduced",
  "1025": "Introduced",
  "10000": "Introduced",
  "10025": "Introduced",
  "8000": "Passed House",
  "17000": "Passed Senate",
  "28000": "To President",
  E20000: "To President",
  "36000": "Became Law",
  E40000: "Became Law",
}
const STAGE_BY_TYPE: Record<string, string> = {
  ResolvingDifferences: "Conference",
  Veto: "Vetoed",
}

// Which steps a measure can reach at all. A simple resolution never leaves its
// own chamber, and drawing it four steps it can never take would be a lie about
// the bill rather than about us.
const HOUSE = "Passed House"
const SENATE = "Passed Senate"
const REST = ["Conference", "To President", "Became Law"]
function ladder(type: string | null | undefined, origin: string | null | undefined) {
  const t = String(type ?? "").toUpperCase()
  const senateFirst = /^S/.test(t) || String(origin ?? "").toLowerCase().startsWith("senate")
  const chambers = senateFirst ? [SENATE, HOUSE] : [HOUSE, SENATE]
  if (t === "HRES") return ["Introduced", HOUSE]
  if (t === "SRES") return ["Introduced", SENATE]
  if (t === "HCONRES" || t === "SCONRES") return ["Introduced", ...chambers]
  return ["Introduced", ...chambers, ...REST]
}

const day = (value: unknown) => (value ? String(value).slice(0, 10) : "")

export function BillTracker({ framed = false }: { framed?: boolean }) {
  const c = use()
  const steps = React.useMemo(() => {
    if (!c) return []
    const reached = new Map<string, string>()
    for (const a of c.actions) {
      const stage = STAGE_BY_CODE[String(a.actionCode ?? "")] ?? STAGE_BY_TYPE[String(a.type ?? "")]
      if (!stage) continue
      const when = day(a.actionDate)
      // Oldest wins: the day a bill first reached a stage is the day it reached
      // it, and BILLSTATUS lists actions newest first.
      const held = reached.get(stage)
      if (!held || (when && when < held)) reached.set(stage, when)
    }
    // H.R. 1 was reported as an original measure, so it has no "Introduced in
    // House" action and the first rung had no date under it. The bill record
    // carries the day it was introduced whether or not an action says so, and
    // congress.gov prints that day beside the sponsor.
    if (!reached.get("Introduced") && c.record?.introducedDate) {
      reached.set("Introduced", day(c.record.introducedDate))
    }
    const rungs = ladder(c.record?.type, c.record?.originChamber)
    const last = rungs.map((r) => reached.has(r)).lastIndexOf(true)
    return rungs.map((title, i) => ({ title, date: reached.get(title) ?? null, done: i <= last && last >= 0 }))
  }, [c])

  if (!c?.onCongress) return null
  if (!steps.length || !c.actions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Progress not harvested for this bill yet.
      </p>
    )
  }
  const current = steps.filter((s) => s.done).at(-1)

  return (
    <div className={cn("not-typeset", !framed && "mt-6")} aria-label="Status of legislation">
      <ol className="flex flex-wrap items-stretch gap-1">
        {steps.map((step) => (
          <li key={step.title} className="min-w-0 flex-1 basis-0">
            <div
              className={cn(
                "h-1 rounded-full",
                step.done ? "bg-foreground" : "bg-border"
              )}
            />
            <div className="mt-2 flex flex-col gap-0.5 pr-1">
              <span
                className={cn(
                  "text-xs leading-tight font-medium",
                  step.done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
              {step.date && (
                <span className="text-xs text-muted-foreground tabular-nums">{step.date}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}


/* ---- actions -------------------------------------------------------------- */

export type HistoryRow = { date: string; chamber: string; action: string; sequence?: number }

const norm = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase()

/**
 * The roll call an action produced.
 *
 * Both chambers print the number in the action's own text — the House as "(Roll
 * no. 190)", the Senate as "Record Vote Number: 372" — and BILLSTATUS carries
 * the House's again as a structured `recordedVote`. The Senate's exists only in
 * the text, because congress.gov publishes House votes and nothing else:
 * /senate-vote/119 is a 404. So the number is read from wherever it is, and
 * matched to the roll call the page is already showing.
 */
const ROLL_IN_TEXT = /\bRoll no\.\s*(\d+)|Record Vote Number:\s*(\d+)/
const rollNumberOf = (action: Action | null, text: string) => {
  const structured = action?.recordedVotes?.[0]?.rollNumber
  if (structured) return String(structured)
  const m = ROLL_IN_TEXT.exec(text)
  return m ? (m[1] ?? m[2]) : null
}
const RC_NUMBER = /RC#\s*(\d+)/

/**
 * Every action on the bill, with the stage, the committee that acted and the
 * roll call it produced — as a data table now (2026-09-05), on the shape the
 * member page's roll calls take.
 *
 * The row set is ours plus congress.gov's, not congress.gov's instead of ours.
 * Measured on H.R. 1: LegiScan holds 141 rows and congress.gov's Actions tab
 * shows 140 — the same list — while BILLSTATUS holds 59, of which 53 are
 * already in ours verbatim. The 87 rows only we have are the amendment actions
 * congress.gov merges in from each amendment's own record, which neither
 * BILLSTATUS nor the API returns as one list. Replacing one with the other
 * would have deleted them.
 *
 * What BILLSTATUS adds is not rows, it is fields: the stage, the action code,
 * the committee that acted, and the roll call with the Clerk's own URL. Those
 * attach to the rows they match by date and text.
 */
function useActionRows(history: HistoryRow[], rollCalls: RollCall[]): ActionTableRow[] {
  const c = use()
  return React.useMemo(() => {
    // chamber/number -> the roll call, so an action can name the vote it took.
    const votes = new Map<string, RollCall>()
    for (const rc of rollCalls) {
      const number = RC_NUMBER.exec(rc.description ?? "")?.[1]
      if (number) votes.set(`${rc.chamber}/${number}`, rc)
    }
    const byKey = new Map<string, Action>()
    for (const a of c?.actions ?? []) byKey.set(`${day(a.actionDate)}|${norm(a.text)}`, a)
    const seen = new Set<string>()
    const merged: { date: string; chamber: string; text: string; action: Action | null }[] = []
    for (const h of history) {
      const key = `${day(h.date)}|${norm(h.action)}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push({ date: day(h.date), chamber: h.chamber, text: h.action, action: byKey.get(key) ?? null })
    }
    // Actions congress.gov has and our history does not — kept rather than
    // dropped, and they name their own chamber through the system that filed
    // them.
    for (const [key, a] of byKey) {
      if (seen.has(key)) continue
      seen.add(key)
      merged.push({
        date: day(a.actionDate),
        chamber: /senate/i.test(a.sourceSystem?.name ?? "") ? "Senate" : /house/i.test(a.sourceSystem?.name ?? "") ? "House" : "",
        text: a.text ?? "",
        action: a,
      })
    }
    merged.sort((x, y) => y.date.localeCompare(x.date))
    return merged.map((row, index) => {
      const number = rollNumberOf(row.action, row.text)
      const rc = number ? votes.get(`${row.chamber}/${number}`) : undefined
      return {
        id: `${row.date}-${index}`,
        date: row.date,
        time: row.action?.actionTime ?? null,
        chamber: row.chamber,
        text: row.text,
        committees: (row.action?.committees ?? []).map((cm) => ({ code: cm.systemCode ?? null, name: cm.name ?? "" })).filter((cm) => cm.name),
        roll: number
          ? {
              label: `${row.chamber} roll call ${number}`,
              tally: rc ? `${rc.yea ?? 0}–${rc.nay ?? 0}` : null,
              clerk: row.action?.recordedVotes?.[0]?.url ?? null,
            }
          : null,
      }
    })
  }, [c, history, rollCalls])
}

/** "Actions" on a Congress bill, "History" on a state bill: the same section, called what its source calls it. */
export function BillActionsBlock({ history, rollCalls = [], bill }: { history: HistoryRow[]; rollCalls?: RollCall[]; bill: string }) {
  const rows = useActionRows(history, rollCalls)
  const c = use()
  const title = c?.onCongress ? "Actions" : "History"
  const first = rows[rows.length - 1]?.date
  const latest = rows[0]?.date
  return (
    <>
      <H3>{title}</H3>
      {rows.length ? (
        <>
          <p>
            {bill} has taken <code>{fmtNumber(rows.length)}</code> {rows.length === 1 ? "action" : "actions"}
            {first ? <> since <code>{fmtDate(first)}</code></> : null}
            {latest && latest !== first ? <>, the latest on <code>{fmtDate(latest)}</code></> : null}.
          </p>
          <ActionTable rows={rows} />
        </>
      ) : (
        <p>No {title.toLowerCase()} on file for {bill} yet.</p>
      )}
    </>
  )
}

/* ---- committees, subjects, cost estimates ---------------------------------- */

export type BillCommittee = {
  systemCode?: string | null
  name?: string | null
  parent?: { systemCode?: string | null; name?: string | null } | null
  chamber?: string | null
  type?: string | null
  activity?: string | null
  date?: string | null
}

/**
 * BILLSTATUS stamps committee activity in UTC; congress.gov prints it Eastern.
 * H.R. 1's markup is `2025-05-21T03:55:00Z` and congress.gov shows 05/20/2025,
 * so `slice(0, 10)` puts every evening action on the wrong day.
 */
const easternDay = (value: string | null | undefined) => {
  if (!value) return ""
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return String(value).slice(0, 10)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(at)
}

/** "Ways and Means Committee" → "Ways and Means"; a subcommittee keeps its own name. */
const shortName = (name: string) => name.replace(/^(House|Senate|Joint) Committee on (the )?/, "").replace(/\s+Committee$/, "")

type CommitteeCount = { committee_name: string; chamber: string; bills: number }

/**
 * Every committee the bill touched, on the card /docs/committees and the
 * member page use — the seal, the name, and one line: what the committee last
 * did with the bill and when (2026-09-05). A state bill's referrals draw the
 * same cards from LegiScan's rows, under the jurisdiction's own seal.
 *
 * congress.gov hides the activities it files as "Unknown" — BILLSTATUS carries
 * two of them on H.R. 1 — and so does this: a row that cannot say what happened
 * is not a row a reader can use. They are on Aurora either way.
 */
export function BillCommitteesBlock({
  bill,
  state,
  referrals,
  counts,
}: {
  bill: string
  state: string
  /** LegiScan's referrals: every committee the bill was sent to. */
  referrals: { date: string; chamber: string; name: string }[]
  /** Bills before each committee this session, from the committees page's own query. */
  counts: CommitteeCount[]
}) {
  const c = use()
  const byKey = new Map(counts.map((r) => [committeeKey(r.chamber, r.committee_name), r.bills]))
  const codes = (CODES as { byCode: Record<string, { chamber: string; name: string }> }).byCode
  type Card = { key: string; href: string; chamber: string | null; title: string; line: string; when: string | null }
  let cards: Card[] = []
  if (c?.onCongress && c.committees.length) {
    // One card per committee, carrying its latest activity; congress.gov's
    // rows are newest first.
    const seen = new Map<string, Card>()
    for (const row of c.committees) {
      if (!row.activity || row.activity.toLowerCase() === "unknown") continue
      const code = row.systemCode ?? row.name ?? ""
      if (seen.has(code)) continue
      seen.set(code, {
        key: code,
        href: row.systemCode ? `/docs/committees/${row.systemCode}` : `/docs/committees?state=${state}`,
        chamber: row.chamber ?? null,
        title: shortName(row.name ?? ""),
        line: row.activity,
        when: row.date ? easternDay(row.date) : null,
      })
    }
    cards = [...seen.values()]
  } else {
    const seen = new Map<string, Card>()
    for (const row of referrals) {
      if (seen.has(row.name)) continue
      seen.set(row.name, {
        key: row.name,
        href: `/docs/committees?state=${state}`,
        chamber: row.chamber,
        title: row.name,
        line: "Referred to",
        when: row.date ? day(row.date) : null,
      })
    }
    cards = [...seen.values()]
  }
  if (!cards.length) return null
  const billsBefore = (card: Card) => {
    const byCode = codes[card.key]
    const keys = [byCode ? committeeKey(byCode.chamber, byCode.name) : null, committeeKey(card.chamber, card.title)].filter(Boolean) as string[]
    for (const key of keys) {
      const n = byKey.get(key)
      if (n != null) return n
    }
    return null
  }
  const names = cards.map((card) => card.title)
  return (
    <>
      <H3>Committees</H3>
      <p>
        {bill} went before <code>{cards.length}</code> {cards.length === 1 ? "committee" : "committees"}:{" "}
        {names.map((name, i) => (
          <React.Fragment key={name}>
            {i > 0 ? (i === names.length - 1 ? " and " : ", ") : ""}
            <code>{name}</code>
          </React.Fragment>
        ))}
        .
      </p>
      <CardBlock
        cards={cards.map((card) => {
          const n = billsBefore(card)
          return {
            key: card.key,
            href: card.href,
            title: card.title,
            media: <ChamberSeal state={state} chamber={card.chamber} size={28} />,
            meta: [card.line, card.when ? fmtDate(card.when) : null, n != null ? `${fmtNumber(n)} Bills` : null].filter(Boolean).join(" · "),
          }
        })}
      />
    </>
  )
}

/** `hb6500/subjects.txt`: the file name a chip box wears. */
const chipFile = (bill: string, name: string) => `${bill.toLowerCase().replace(/[^a-z0-9]/g, "")}/${name}.txt`

/**
 * A box of badges in the file block: the seal, the file name, Expand and
 * Copy. Three rows show; expanded, six, with the rest scrolling inside
 * (Brendan, 2026-09-05: "we can't show the whole block, it's too big"). The
 * rows are measured from the badges themselves, so they hold at any width.
 */
function ChipBlock({ file, chips, lit, chamber, state }: { file: string; chips: string[]; lit?: string | null; chamber: string | null; state: string }) {
  const box = React.useRef<HTMLDivElement>(null)
  const [limit, setLimit] = React.useState<{ closed: number; open: number } | null>(null)
  React.useEffect(() => {
    const el = box.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const gap = parseFloat(getComputedStyle(el).rowGap) || 8
    const h = first.offsetHeight
    setLimit({ closed: 3 * h + 2 * gap, open: 6 * h + 5 * gap })
  }, [chips])
  return (
    <FileBlock
      icon={<ChamberSeal state={state} chamber={chamber} size={16} />}
      title={file}
      text={() => chips.join("\n")}
      limit={limit ?? { closed: 76, open: 160 }}
    >
      <div ref={box} className="flex w-full flex-wrap gap-2">
        {chips.map((name) => (
          <Badge key={name} variant={name === lit ? "default" : "secondary"}>
            {name}
          </Badge>
        ))}
      </div>
    </FileBlock>
  )
}

/**
 * Classification, a section of its own at the foot of the page (Brendan,
 * 2026-09-05): CRS's policy areas in one box — the whole vocabulary, this
 * bill's own lit and first — and its legislative subjects in another.
 */
export function BillSubjects({ bill, chamber, state }: { bill: string; chamber: string | null; state: string }) {
  const c = use()
  if (!c?.onCongress) return null
  const area = c.policyArea
  const subjects = c.subjects ?? []
  if (!area && !subjects.length) return null
  const areas = area ? [area, ...c.policyAreas.filter((name) => name !== area)] : c.policyAreas
  return (
    <>
      <hr />
      <H2>Classification</H2>
      <p>
        {area ? (
          <>
            The Congressional Research Service files {bill} under <code>{area}</code>
            {areas.length > 1 ? <>, one of its <code>{fmtNumber(areas.length)}</code> policy areas</> : null}
            {subjects.length ? <>, and gives it <code>{fmtNumber(subjects.length)}</code> legislative {subjects.length === 1 ? "subject" : "subjects"}</> : null}.
          </>
        ) : (
          <>
            The Congressional Research Service gives {bill} <code>{fmtNumber(subjects.length)}</code> legislative {subjects.length === 1 ? "subject" : "subjects"}.
          </>
        )}
      </p>
      {area && (
        <>
          <H3>CRS Subjects</H3>
          <p>
            CRS assigns every bill one policy area
            {areas.length > 1 ? <> from its <code>{fmtNumber(areas.length)}</code></> : null}; {bill}&rsquo;s is <code>{area}</code>.
          </p>
          <ChipBlock file={chipFile(bill, "policy-areas")} chips={areas} lit={area} chamber={chamber} state={state} />
        </>
      )}
      {subjects.length > 0 && (
        <>
          <H3>Legislative Subjects</H3>
          <p>
            {bill} carries <code>{fmtNumber(subjects.length)}</code> of CRS&rsquo;s legislative {subjects.length === 1 ? "subject" : "subjects"}
            {subjects.length > 1 ? <>, from <code>{subjects[0]}</code> to <code>{subjects[subjects.length - 1]}</code></> : <>: <code>{subjects[0]}</code></>}.
          </p>
          <ChipBlock file={chipFile(bill, "subjects")} chips={subjects} chamber={chamber} state={state} />
        </>
      )}
    </>
  )
}

/**
 * CBO's estimates: title, date and link, and no numbers.
 *
 * Lane B measured this — the metadata is free and the figures behind it are
 * behind DataDome. Printing a number we cannot fetch would be inventing one.
 */
export function BillCostEstimates({ bill }: { bill: string }) {
  const c = use()
  if (!c?.onCongress) return null
  const rows = c.cbo ?? []
  if (!rows.length) return null
  return (
    <>
      <H3>Cost estimate</H3>
      <p>
        The Congressional Budget Office has filed <code>{rows.length}</code> {rows.length === 1 ? "estimate" : "estimates"} for {bill}
        {rows[0].pubDate ? <>, the latest on <code>{fmtDate(easternDay(rows[0].pubDate))}</code></> : null}.
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.url}>
            <a href={row.url} target="_blank" rel="noopener noreferrer">
              {row.title ?? row.url}
            </a>
            {row.pubDate && <> — {easternDay(row.pubDate)}</>}
            {row.description && <span className="block text-sm text-muted-foreground">{row.description}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---- notes and the constitutional authority statement ---------------------- */

/**
 * The clause of the Constitution the sponsor cites as the power to legislate.
 *
 * Required of every House bill since 2011 and published in BILLSTATUS as a
 * `<pre>` block quoting the Congressional Record; 6,977 of the 119th's 18,514
 * bills carry one, and H.R. 1 does not, because it was reported as an original
 * measure rather than introduced.
 *
 * Rendered as the block it is, with the markup stripped rather than injected.
 * Words run together in it — "pursuantto the following" — because they run
 * together in govinfo's own CDATA, which lost the Record's line breaks before
 * we ever saw it. Repairing that would mean guessing where the lines were.
 *
 * `notes` is congress.gov's own field for a bill-level editorial note. It is
 * null on every bill sampled and BILLSTATUS has no element for it at all, so
 * the section simply does not appear rather than standing empty forever.
 */
const stripTags = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim()

/** The docs' code-block copy button: top right, shown on hover, a check for a moment (Brendan, 2026-09-05). */
function CopyCorner({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy"}
      className="absolute top-3 right-2 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/pre:opacity-100 hover:bg-accent hover:text-accent-foreground focus-visible:opacity-100 [&_svg]:size-4"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

export function BillNotes({ bill }: { bill: string }) {
  const c = use()
  if (!c?.onCongress) return null
  const authority = c.record?.constitutionalAuthorityStatementText
  const notes = c.record?.notes ?? []
  if (!authority && !notes.length) return null
  return (
    <>
      {authority && (
        <>
          <hr />
          <H2>Constitutional authority</H2>
          <p>The clause the sponsor cites as Congress&rsquo;s power to enact {bill}, as entered in the Congressional Record.</p>
          <div className="group/pre relative">
            <pre className="text-sm whitespace-pre-wrap">{stripTags(authority)}</pre>
            <CopyCorner text={stripTags(authority)} />
          </div>
        </>
      )}
      {notes.length > 0 && (
        <>
          <hr />
          <H2>Notes</H2>
          <p>
            congress.gov carries <code>{notes.length}</code> {notes.length === 1 ? "note" : "notes"} on {bill}.
          </p>
          <ul>
            {notes.map((note, index) => (
              <li key={index}>
                {note.text ? stripTags(note.text) : null}
                {note.links?.map((link) => (
                  <span key={link.url}>
                    {" "}
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.name ?? link.url}
                    </a>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
