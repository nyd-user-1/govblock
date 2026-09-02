"use client"

import * as React from "react"

import Link from "next/link"

import type { RollCall } from "@/lib/policy/types"
import { useCongress, useCongressRecord } from "@/lib/policy/use-congress"
import { H2, Table } from "@/components/typeset"
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
}

const Ctx = React.createContext<Depth | null>(null)
const use = () => React.useContext(Ctx)

/** For the rail, which names the sections a bill actually has. */
export const useBillDepth = () => React.useContext(Ctx)

export function BillDepthProvider({
  billId,
  state,
  children,
}: {
  billId: number
  state: string
  children: React.ReactNode
}) {
  const bill = String(billId)
  const scope = React.useMemo(() => ({ param: "bill", value: bill }), [bill])

  const actions = useCongress<Action>("actions", "actions", scope, { bill, limit: 500 }, undefined, state)
  // One row rather than a family. The scope is still checked: an answer that
  // does not name this bill is not this bill's record, whatever it holds.
  const record = useCongressRecord<{ bill?: number; record?: BillRecord | null }>(
    "bill-record",
    { bill },
    (answer) => String(answer?.bill ?? "") === bill && !!answer?.record,
    state
  )

  const committees = useCongress<BillCommittee>("bill-committees", "committees", scope, { bill }, undefined, state)
  const cbo = useCongress<CboEstimate>("cbo-estimates", "cboCostEstimates", scope, { bill }, undefined, state)
  // Subjects come back in the API's own nesting — a policy area beside a list —
  // so the envelope is read whole rather than as a family of rows.
  const subjects = useCongressRecord<{ bill?: number; subjects?: { policyArea?: { name?: string } | null; legislativeSubjects?: { name?: string }[] } }>(
    "bill-subjects",
    { bill },
    (answer) => String(answer?.bill ?? "") === bill,
    state
  )

  const value = React.useMemo<Depth>(
    () => ({
      billId,
      onCongress: actions.onCongress,
      actions: actions.rows,
      actionTotal: actions.count,
      record: record?.record ?? null,
      committees: committees.rows,
      policyArea: subjects?.subjects?.policyArea?.name ?? null,
      subjects: (subjects?.subjects?.legislativeSubjects ?? []).map((row) => row.name ?? "").filter(Boolean),
      cbo: cbo.rows,
    }),
    [billId, actions.onCongress, actions.rows, actions.count, record, committees.rows, subjects, cbo.rows]
  )
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
 * Resolving Differences and Vetoed have no single code and are taken from the
 * action's `type`, which BILLSTATUS publishes for every action.
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
  ResolvingDifferences: "Resolving Differences",
  Veto: "Vetoed",
}

// Which steps a measure can reach at all. A simple resolution never leaves its
// own chamber, and drawing it four steps it can never take would be a lie about
// the bill rather than about us.
const HOUSE = "Passed House"
const SENATE = "Passed Senate"
const REST = ["Resolving Differences", "To President", "Became Law"]
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

export function BillTracker() {
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
    <div className="not-typeset mt-6" aria-label="Status of legislation">
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
      {current && (
        <p className="mt-3 text-sm text-muted-foreground">
          This bill has the status <strong className="text-foreground">{current.title}</strong>.
        </p>
      )}
    </div>
  )
}

/* ---- actions -------------------------------------------------------------- */

export type HistoryRow = { date: string; chamber: string; action: string; sequence?: number }

const norm = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase()

/**
 * The Congressional Record page an action cites.
 *
 * congress.gov prints the citation inside the action's own text — "(text: CR
 * H3059-3143)", "(consideration: CR S4072)" — and links it. Nothing in
 * BILLSTATUS carries the URL, so it is built the way congress.gov builds it:
 * the volume is the year less 1854 (2025 is volume 171, checked against
 * /volume-171/house-section/page/H3059, which is the debate on the Senate
 * amendment to H.R. 1), and the letter names the section.
 *
 * Only H, S and E are linked. D is the Daily Digest, which is paged separately,
 * and anything else is left as the text it already is — a citation that reads
 * is better than a link that 404s.
 */
const CR_SECTION: Record<string, string> = { H: "house-section", S: "senate-section", E: "extensions-of-remarks-section" }
function recordHref(page: string, date: string | null | undefined) {
  const year = Number(String(date ?? "").slice(0, 4))
  const section = CR_SECTION[page.slice(0, 1).toUpperCase()]
  if (!section || !Number.isFinite(year) || year < 1990) return null
  return `https://www.congress.gov/congressional-record/volume-${year - 1854}/${section}/page/${page}`
}

/** An action's text with its Record citations turned into links. */
function withRecordLinks(text: string, date: string | null | undefined) {
  const parts: React.ReactNode[] = []
  const pattern = /\bCR\s+([HSED]\d+)(-(?:[HSED]?\d+))?/g
  let last = 0
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    const href = recordHref(m[1], date)
    parts.push(text.slice(last, m.index))
    if (href) {
      parts.push(
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer">
          {m[0]}
        </a>
      )
    } else {
      parts.push(m[0])
    }
    last = m.index + m[0].length
  }
  if (!parts.length) return text
  parts.push(text.slice(last))
  return parts
}

/**
 * Every action on the bill, with the stage, the committee that acted and the
 * roll call it produced.
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

export function BillActions({
  history,
  rollCalls = [],
  fallback,
}: {
  history: HistoryRow[]
  rollCalls?: RollCall[]
  fallback: React.ReactNode
}) {
  const c = use()
  // chamber/number -> the roll call, so an action can name the vote it took and
  // the vote can be reached from the row that took it.
  const votes = React.useMemo(() => {
    const map = new Map<string, RollCall>()
    for (const rc of rollCalls) {
      const number = RC_NUMBER.exec(rc.description ?? "")?.[1]
      if (number) map.set(`${rc.chamber}/${number}`, rc)
    }
    return map
  }, [rollCalls])
  const rows = React.useMemo(() => {
    if (!c?.onCongress) return null
    const byKey = new Map<string, Action>()
    for (const a of c.actions) byKey.set(`${day(a.actionDate)}|${norm(a.text)}`, a)
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
    return merged.sort((x, y) => y.date.localeCompare(x.date))
  }, [c, history])

  if (!c?.onCongress || !rows) return <>{fallback}</>
  if (!rows.length) return <p>No actions on file yet.</p>

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {rows.length} action{rows.length === 1 ? "" : "s"}
        {c.actionTotal ? `, ${c.actionTotal} of them carrying congress.gov's stage and codes` : ""}.
      </p>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Chamber</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.date}-${index}`}>
              <td className="whitespace-nowrap tabular-nums">
                {row.date}
                {row.action?.actionTime && (
                  <span className="block text-xs text-muted-foreground">{row.action.actionTime.slice(0, 5)}</span>
                )}
              </td>
              <td>{row.chamber}</td>
              <td>
                {withRecordLinks(row.text, row.date)}
                {Boolean(row.action?.committees?.length || row.action?.recordedVotes?.length) && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {row.action?.committees?.map((cm) => (
                      <span key={cm.systemCode ?? cm.name}>
                        <Link href={`/docs/committees/${cm.systemCode}`} className="no-underline hover:underline">
                          {cm.name}
                        </Link>{" "}
                      </span>
                    ))}
                    {(() => {
                      const number = rollNumberOf(row.action, row.text)
                      if (!number) return null
                      const rc = votes.get(`${row.chamber}/${number}`)
                      const clerk = row.action?.recordedVotes?.[0]?.url ?? null
                      const label = `${row.chamber} roll call ${number}`
                      return (
                        <span>
                          <a href="#votes" className="no-underline hover:underline">
                            {label}
                          </a>
                          {rc && (
                            <span className="tabular-nums">
                              {" "}
                              {rc.yea ?? 0}–{rc.nay ?? 0}
                            </span>
                          )}
                          {clerk && (
                            <>
                              {" · "}
                              <a href={clerk} target="_blank" rel="noopener noreferrer">
                                Clerk
                              </a>
                            </>
                          )}
                        </span>
                      )
                    })()}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
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

/**
 * Every committee and subcommittee the bill touched, and what it did.
 *
 * congress.gov hides the activities it files as "Unknown" — BILLSTATUS carries
 * two of them on H.R. 1 — and so does this: a row that cannot say what happened
 * is not a row a reader can use. They are on Aurora either way.
 */
export function BillCommittees() {
  const c = use()
  if (!c?.onCongress) return null
  const rows = (c.committees ?? []).filter((row) => row.activity && row.activity.toLowerCase() !== "unknown")
  return (
    <>
      <H2>Committees</H2>
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <th>Committee</th>
              <th>Date</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.systemCode}-${row.activity}-${index}`}>
                <td>
                  {row.systemCode ? (
                    <Link href={`/docs/committees/${row.systemCode}`} className="no-underline hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                  {row.parent?.name && (
                    <span className="block text-xs text-muted-foreground">{row.parent.name}</span>
                  )}
                </td>
                <td className="whitespace-nowrap tabular-nums">{easternDay(row.date)}</td>
                <td>{row.activity}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p>No committee activity harvested for this bill yet.</p>
      )}
    </>
  )
}

/** The policy area CRS assigns, then every legislative subject it carries. */
export function BillSubjects() {
  const c = use()
  const [all, setAll] = React.useState(false)
  if (!c?.onCongress) return null
  const area = c.policyArea
  const subjects = c.subjects ?? []
  const SHOWN = 40
  const shown = all ? subjects : subjects.slice(0, SHOWN)
  return (
    <>
      <H2>Subjects</H2>
      {!area && !subjects.length ? (
        <p>No subjects harvested for this bill yet.</p>
      ) : (
        <>
          {area && (
            <p>
              <strong>Policy area:</strong> {area}
            </p>
          )}
          {subjects.length > 0 && (
            <>
              <p>{shown.map((name) => name).join(" · ")}</p>
              {subjects.length > SHOWN && (
                <p>
                  <button
                    type="button"
                    className="cursor-pointer text-sm underline underline-offset-4"
                    onClick={() => setAll((open) => !open)}
                  >
                    {all ? "Show fewer" : `Show all ${subjects.length} legislative subjects`}
                  </button>
                </p>
              )}
            </>
          )}
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
export function BillCostEstimates() {
  const c = use()
  if (!c?.onCongress) return null
  const rows = c.cbo ?? []
  if (!rows.length) return null
  return (
    <>
      <H2>Cost estimate</H2>
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

export function BillNotes() {
  const c = use()
  if (!c?.onCongress) return null
  const authority = c.record?.constitutionalAuthorityStatementText
  const notes = c.record?.notes ?? []
  if (!authority && !notes.length) return null
  return (
    <>
      {authority && (
        <>
          <H2>Constitutional authority</H2>
          <pre className="text-sm whitespace-pre-wrap">{stripTags(authority)}</pre>
        </>
      )}
      {notes.length > 0 && (
        <>
          <H2>Notes</H2>
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
