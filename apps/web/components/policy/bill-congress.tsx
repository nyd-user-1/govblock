"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber, honorific, truncate } from "@/lib/format"
import { usePolicy } from "@/lib/policy/use-policy"
import { billRef, congressGovHref, day, stageRank, summaryBlocks, type SummaryBlock } from "@/lib/policy/congress"
import { useCongress } from "@/lib/policy/use-congress"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { H2, H3 } from "@/components/typeset"
import { useBillDepth } from "@/components/policy/bill-depth"
import { VoteTable, type VoteTableRow } from "@/components/policy/bill-tables"
import { PagedList } from "@/components/policy/paged-list"
import { RecordItem, RecordSeal } from "@/components/policy/record-item"
import { PreviewFrame } from "@/components/preview-frame"
import { FileBlock } from "@/components/file-block"
import { Chip } from "@/components/chip"
import { ChamberSeal } from "@/components/policy/imagery"
import { MemberCard, type MemberCardRow } from "@/components/policy/member-card"
import { BillText } from "@/components/bill-text"
import { DocsTableOfContents } from "@/components/docs-toc"

// What congress.gov holds about a bill, on the bill's own page: the text
// versions it moved through, the CRS summary written at each stage, the
// amendments offered to it, the bills it travels with, the names it goes by,
// the committee reports filed on it, and — when it became law — its citation.
//
// Since 2026-09-05 the page reads like the member page: one sentence under
// every heading, derived from the rows beneath it, and every list or table in
// the same frame with the same footer. The path names one bill, so every read
// here is made in that bill's own jurisdiction rather than the reader's: a
// federal bill's amendments are federal records whoever is looking at them.
// The page fetches every family on the server and hands the rows in, so the
// first render holds them; a family the page could not fetch reads in the
// browser as before.

export type Version = {
  document_id: number | null
  version: string | null
  source: string | null
  chars: number | null
  fetched_at?: string | null
  url: string | null
  date?: string | null
  // The other renderings govinfo publishes of the same version. Derived from
  // the package id rather than fetched — /pdf/{pkg}.pdf and /html/{pkg}.htm are
  // uniform across govinfo, checked on 28 packages before it was relied on —
  // except the XML, which is taken as published because a bill carries /xml and
  // a public law carries /uslm.
  formats?: { type: string; url: string }[]
}
export type Summary = {
  actionDate?: string
  actionDesc?: string
  text?: string
  updateDate?: string
}
export type Amendment = {
  number?: string
  type?: string
  congress?: number
  chamber?: string
  purpose?: string
  description?: string
  latestAction?: { actionDate?: string; text?: string }
  sponsors?: { fullName?: string; bioguideId?: string }[]
  amendedBill?: { number?: string; type?: string }
}
// Aurora's row wraps the record as govinfo published it in `payload`, with our
// own id for the other bill beside it; the committed snapshot is the bare
// record. Both reach the list through `asRelated`.
export type Related = {
  congress?: number | string
  number?: number | string
  type?: string
  title?: string
  latestAction?: { actionDate?: string; text?: string }
  relationshipDetails?: { type?: string; identifiedBy?: string }[] | { item?: { type?: string; identifiedBy?: string } }
  payload?: Related
  related_bill_id?: number | null
  related_bill_number?: string
  relationship?: string
}
export type Title = {
  title?: string
  titleType?: string
  chamberName?: string
  billTextVersionName?: string
}
export type Report = { citation?: string; url?: string; title?: string; chamber?: string; issueDate?: string }
export type Cosponsor = {
  fullName?: string
  firstName?: string
  lastName?: string
  bioguideId?: string
  party?: string
  state?: string
  district?: string | number
  sponsorshipDate?: string
  sponsorshipWithdrawnDate?: string | null
  // The route answers `"True"` / `"False"` as text where the committed record
  // has a real boolean, and `"False"` is truthy. Read it through `truth()`.
  isOriginalCosponsor?: boolean | string
  /** Lane C's route resolves the bioguide id to our own member id. */
  people_id?: number | null
}
export type LawBill = {
  type?: string
  number?: string
  laws?: { number?: string; type?: string }[]
  // CRS's one-line classification of the bill. It rides on the bill record the
  // law family is cut from; where the route trims it, it is simply absent.
  policyArea?: { name?: string } | null
}

type Bill = { billId: number; billNumber: string; state: string }

type Congress = Bill & {
  ready: boolean
  onCongress: boolean
  versions: Version[]
  summaries: Summary[]
  amendments: Amendment[]
  amendmentTotal: number
  related: Related[]
  titles: Title[]
  reports: Report[]
  cosponsors: Cosponsor[]
  law: { number?: string; type?: string } | null
  policyArea: string | null
}

/** What the page fetched on the server, so the first render holds it. */
export type CongressInitial = {
  versions?: Version[] | null
  summaries?: Summary[] | null
  amendments?: { count: number; amendments: Amendment[] } | null
  related?: Related[] | null
  titles?: Title[] | null
  reports?: Report[] | null
  cosponsors?: Cosponsor[] | null
  laws?: LawBill[] | null
}

const Ctx = React.createContext<Congress | null>(null)
const use = () => React.useContext(Ctx)

export function BillCongressProvider({ billId, billNumber, state, initial, children }: Bill & { initial?: CongressInitial; children: React.ReactNode }) {
  // The path names one bill, and a bill belongs to a jurisdiction of its own.
  // A federal bill's text versions and amendments are federal records whoever
  // is reading them, so this page reads in the bill's jurisdiction rather than
  // the reader's — which is also why nothing here waits for the switcher.
  const on = state === "US"
  const bill = String(billId)
  const scope = React.useMemo(() => ({ param: "bill", value: bill }), [bill])
  const ref = React.useMemo(() => billRef(billNumber), [billNumber])

  // An amendment belongs on this page only if its own record says it amends
  // this bill; a law row only if it is this bill's row.
  const amends = React.useCallback((row: Amendment) => !!ref && String(row.amendedBill?.type ?? "").toUpperCase() === ref.type && String(row.amendedBill?.number ?? "") === ref.number, [ref])
  const enacts = React.useCallback((row: LawBill) => !!ref && String(row.type ?? "").toUpperCase() === ref.type && String(row.number ?? "") === ref.number, [ref])

  // A family the page handed in is not fetched again; one it did not reads
  // through the route and then the committed record, as it always has.
  const held = <T,>(rows: T[] | null | undefined) => (rows && rows.length ? rows : null)
  const hv = held(initial?.versions)
  const hs = held(initial?.summaries)
  const ha = held(initial?.amendments?.amendments)
  const hr = held(initial?.related)
  const ht = held(initial?.titles)
  const hp = held(initial?.reports)
  const hc = held(initial?.cosponsors)
  const hl = held(initial?.laws)

  const versions = useCongress<Version>(hv ? null : "text-versions", "textVersions", scope, { bill }, undefined, state)
  const summaries = useCongress<Summary>(hs ? null : "summaries", "summaries", scope, { bill }, undefined, state)
  const amendments = useCongress<Amendment>(ha ? null : "amendments", "amendments", scope, { bill, limit: 50 }, amends, state)
  const related = useCongress<Related>(hr ? null : "related-bills", "relatedBills", scope, { bill }, undefined, state)
  const titles = useCongress<Title>(ht ? null : "titles", "titles", scope, { bill }, undefined, state)
  const reports = useCongress<Report>(hp ? null : "committee-reports", "reports", scope, { bill }, undefined, state)
  const cosponsors = useCongress<Cosponsor>(hc ? null : "cosponsors", "cosponsors", scope, { bill }, undefined, state)
  const laws = useCongress<LawBill>(hl ? null : "laws", "bills", scope, { bill }, enacts, state)

  const value = React.useMemo<Congress>(() => {
    const lawRows = hl ?? laws.rows
    return {
      billId,
      billNumber,
      state,
      ready: on,
      onCongress: on,
      versions: [...(hv ?? versions.rows)].sort((a, b) => stageRank(a.version) - stageRank(b.version) || day(a.date).localeCompare(day(b.date))),
      summaries: [...(hs ?? summaries.rows)].sort((a, b) => day(b.actionDate).localeCompare(day(a.actionDate))),
      amendments: ha ?? amendments.rows,
      amendmentTotal: ha ? (initial?.amendments?.count ?? ha.length) : amendments.count,
      related: hr ?? related.rows,
      titles: ht ?? titles.rows,
      reports: hp ?? reports.rows,
      cosponsors: hc ?? cosponsors.rows,
      law: lawRows[0]?.laws?.[0] ?? null,
      policyArea: lawRows[0]?.policyArea?.name ?? null,
    }
  }, [billId, billNumber, state, on, initial, hv, hs, ha, hr, ht, hp, hc, hl, versions.rows, summaries.rows, amendments.rows, amendments.count, related.rows, titles.rows, reports.rows, cosponsors.rows, laws.rows])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** For the page, which names the sections a bill actually has. */
export const useBillCongress = () => React.useContext(Ctx)

/* ---- summary --------------------------------------------------------------- */

// `"False"` is a truthy string, and it is what the route sends. Every cosponsor
// on a 338-name bill read "Yes" under Original until this existed.
const truth = (value: boolean | string | null | undefined) => (typeof value === "string" ? /^(true|t|1|yes)$/i.test(value.trim()) : !!value)
// The page's own rule: drop the chamber prefix and the zero padding, so
// "HD-NY-025" reads "NY-25".
const district = (value: string | null | undefined) => (value ?? "").replace(/^[A-Z]+-/, "").replace(/(^|-)0+(?=\d)/g, "$1")

export type SponsorRow = {
  people_id: number
  name: string
  party: string
  district: string
  type: number | null
  role?: string | null
  chamber?: string | null
  photo_url?: string | null
  bioguide_id: string | null
}

/**
 * The prime sponsor: LegiScan's type 1, or, where a source files no types at
 * all (New York), the first name in the list — that pipeline writes them in
 * the order the bill prints them.
 */
export const primeOf = (sponsors: SponsorRow[]) => sponsors.find((row) => row.type === 1) ?? (sponsors[0] && sponsors[0].type == null ? sponsors[0] : null)

/**
 * A bill's title as a clause after its number. An Act reads as a name; a
 * federal title beginning "To ..." reads as its purpose; a state description
 * beginning with a verb ("Excludes certain...") reads as a relative clause;
 * anything else is quoted.
 */
export function titleClause(title: string) {
  const clean = title.trim().replace(/\.$/, "")
  if (/\b(Act|Resolution)\b/.test(clean) && clean.length <= 160) return `the ${clean}`
  if (/^To\s/.test(clean)) return clean.charAt(0).toLowerCase() + clean.slice(1)
  if (/^(A bill|A resolution|An act)\b/i.test(clean)) return clean.charAt(0).toLowerCase() + clean.slice(1)
  if (/^[A-Z][a-z]+s\b/.test(clean)) return `which ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`
  return `\u201c${clean}\u201d`
}

export type BillFacts = {
  number: string
  title: string
  chamber: string | null
  status: string | null
  lastAction: string | null
  lastActionDate: string | null
  committee: string | null
  introduced: string | null
  sponsors: SponsorRow[]
  rollCalls: number
}

/**
 * The sentence under Summary, derived: what the bill is, who introduced it and
 * when, how many stand with them, where it went, and where it stands. Every
 * value is on the bill's own row; the cosponsor count is congress.gov's where
 * the bill is federal, because that source knows who joined and who withdrew.
 */
export function BillSummaryLead({ facts }: { facts: BillFacts }) {
  const c = use()
  const depth = useBillDepth()
  const prime = primeOf(facts.sponsors)
  const cosponsors = c?.onCongress && c.cosponsors.length ? c.cosponsors.length : facts.sponsors.filter((row) => row !== prime).length
  const introduced = depth?.record?.introducedDate ?? facts.introduced
  const chamber = facts.chamber ? `the ${facts.chamber}` : "the legislature"
  const who = prime ? `${honorific(prime.role ?? "", prime.chamber ?? facts.chamber ?? "")} ${prime.name}${prime.party ? ` (${prime.party})` : ""}`.trim() : null
  const law = c?.law?.number ? `${c.law.type ?? "Public Law"} ${c.law.number}` : null
  return (
    <p>
      <Chip>{facts.number}</Chip>
      {facts.title ? <>, {titleClause(facts.title)},</> : null} was introduced in {chamber}
      {introduced ? <> on {fmtDate(introduced)}</> : null}
      {who ? (
        <>
          {" "}
          by <Chip>{who}</Chip>
        </>
      ) : null}
      {cosponsors ? (
        <>
          {" "}
          with {fmtNumber(cosponsors)} {cosponsors === 1 ? "co-sponsor" : "co-sponsors"}
        </>
      ) : null}
      .{" "}
      {facts.committee ? (
        <>
          It was referred to <Chip>{facts.committee}</Chip>, and{" "}
        </>
      ) : (
        "It "
      )}
      {facts.lastActionDate ? (
        <>
          last saw action on {fmtDate(facts.lastActionDate)}
          {facts.lastAction ? <>: {facts.lastAction.replace(/\.$/, "")}</> : null}.
        </>
      ) : facts.status ? (
        <>stands at {facts.status}.</>
      ) : (
        "has no recorded action yet."
      )}
      {law ? (
        <>
          {" "}
          It is now <Chip>{law}</Chip>.
        </>
      ) : null}
    </p>
  )
}

/** `08/08/2026`: the date as congress.gov prints it beside a summary's stage. */
const usDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value
}

/** `hb6500/passed-senate.md`: the file name a stage's summary block wears. */
const summaryFile = (number: string, stage: string) =>
  `${number.toLowerCase().replace(/[^a-z0-9]/g, "")}/${
    stage
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "summary"
  }.md`

/** One summary as congress.gov prints it: "Shown Here:", the stage and its date, the bold title, paragraphs and bullets. */
function SummaryBody({ stage, date, blocks }: { stage: string; date: string | null; blocks: SummaryBlock[] }) {
  // Runs of list items become one list, as they were in the source.
  const groups: (SummaryBlock | SummaryBlock[])[] = []
  for (const block of blocks) {
    const last = groups[groups.length - 1]
    if (block.kind === "li" && Array.isArray(last)) last.push(block)
    else groups.push(block.kind === "li" ? [block] : block)
  }
  return (
    <div className="text-sm leading-relaxed [&_li]:mt-1 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <p>
        <strong>Shown Here:</strong>
        <br />
        <strong>
          {stage}
          {date ? ` (${usDate(date)})` : ""}
        </strong>
      </p>
      {groups.map((group, i) =>
        Array.isArray(group) ? (
          <ul key={i}>
            {group.map((item, j) => (
              <li key={j}>{item.text}</li>
            ))}
          </ul>
        ) : group.kind === "strong" ? (
          <p key={i}>
            <strong>{group.text}</strong>
          </p>
        ) : (
          <p key={i}>{group.text}</p>
        )
      )}
    </div>
  )
}

/**
 * The CRS summaries, a sub-section of the Introduction (Brendan, 2026-09-05):
 * the heading, the one-line lead, then shadcn's Steps — every stage its own
 * step down the rule, newest first, the stage as the heading with its date in
 * code — and under each the block, in the file figure the bill's text wears:
 * the seal, `hb6500/passed-senate.md`, Expand and Copy. Inside, the summary
 * as congress.gov prints it. One block per stage, so the Versions menu the
 * single block carried has no work left to do.
 */
export function BillSummaries({ fallback, chamber }: { fallback: React.ReactNode; chamber: string | null }) {
  const c = use()
  if (!c?.summaries.length) return <>{fallback}</>
  return (
    <>
      <H3>CRS Summary</H3>
      <p>
        The summaries are the Congressional Research Service&rsquo;s, one per stage.{" "}
        <a href={congressGovHref("bill", billRef(c.billNumber)?.type ?? "HR", billRef(c.billNumber)?.number ?? "")} target="_blank" rel="noopener noreferrer">
          Read them in full
        </a>
        .
      </p>
      <div className="steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step">
        {c.summaries.map((summary, index) => {
          const stage = summary.actionDesc ?? "Summary"
          const blocks = summaryBlocks(summary.text)
          const shown = `Shown Here:\n${stage}${summary.actionDate ? ` (${usDate(summary.actionDate)})` : ""}`
          const plain = [shown, ...blocks.map((b) => (b.kind === "li" ? `• ${b.text}` : b.text))].join("\n\n")
          return (
            <React.Fragment key={`${stage}-${summary.actionDate}-${index}`}>
              <H3 id={`summary-${index + 1}`}>
                {stage}
                {summary.actionDate ? <> {fmtDate(summary.actionDate)}</> : null}
              </H3>
              <FileBlock icon={<ChamberSeal state={c.state} chamber={chamber} size={16} />} title={summaryFile(c.billNumber, stage)} text={() => plain} collapsed="data-[state=closed]:max-h-[300px]" className="mb-0 last:mb-12">
                <SummaryBody stage={stage} date={summary.actionDate ?? null} blocks={blocks} />
              </FileBlock>
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}

/** The sentence under Text, the record in one line: "HB 6500 has 1 co-sponsor, 6 roll calls and 13 amendments." (Brendan, 2026-09-05). */
export function BillRecordLead({ facts }: { facts: BillFacts }) {
  const c = use()
  const prime = primeOf(facts.sponsors)
  const cosponsors = c?.onCongress && c.cosponsors.length ? c.cosponsors.length : facts.sponsors.filter((row) => row !== prime).length
  const amendments = c?.onCongress ? c.amendmentTotal : 0
  // Only what the bill has; a count of zero is said once, in words, at the end.
  const parts: React.ReactNode[] = []
  if (cosponsors)
    parts.push(
      <React.Fragment key="co">
        {fmtNumber(cosponsors)} {cosponsors === 1 ? "co-sponsor" : "co-sponsors"}
      </React.Fragment>
    )
  if (facts.rollCalls)
    parts.push(
      <React.Fragment key="rc">
        {fmtNumber(facts.rollCalls)} {facts.rollCalls === 1 ? "roll call" : "roll calls"}
      </React.Fragment>
    )
  if (amendments)
    parts.push(
      <React.Fragment key="am">
        {fmtNumber(amendments)} {amendments === 1 ? "amendment" : "amendments"}
      </React.Fragment>
    )
  if (!parts.length)
    return (
      <p>
        <Chip>{facts.number}</Chip> has no co-sponsors and has not gone to a roll call.
      </p>
    )
  return (
    <p>
      <Chip>{facts.number}</Chip> has{" "}
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (i === parts.length - 1 ? " and " : ", ") : ""}
          {part}
        </React.Fragment>
      ))}
      .
    </p>
  )
}

/* ---- sponsors --------------------------------------------------------------- */

/**
 * The bill's sponsorship, once, as cards.
 *
 * On a Congress bill the rows are congress.gov's, because it is the source that
 * knows when each name joined and who withdrew — but the *names* and faces
 * come from `People` where a bioguide id matches, so a cosponsor reads "Joseph
 * Morelle" with their portrait and links to their page here, rather than
 * reading "Rep. Morelle, Joseph D. [D-NY-25]" and linking nowhere. Where no
 * People row matches, congress.gov's own name stands as it is: a name we
 * cannot resolve is still a name.
 *
 * A state bill has no congress.gov table, so it keeps LegiScan's list.
 */
export function BillSponsorsBlock({ sponsors, state, bill }: { sponsors: SponsorRow[]; state: string; bill: string }) {
  const c = use()
  const depth = useBillDepth()
  const prime = primeOf(sponsors)
  const byBioguide = React.useMemo(() => {
    const map = new Map<string, SponsorRow>()
    for (const row of sponsors) if (row.bioguide_id) map.set(row.bioguide_id.toUpperCase(), row)
    return map
  }, [sponsors])

  const cosponsors = c?.cosponsors ?? []
  const dated = !!(c?.onCongress && cosponsors.length)
  const rows: MemberCardRow[] = []
  const seat = (row: SponsorRow) => [honorific(row.role ?? "", row.chamber ?? ""), [row.party, district(row.district)].filter(Boolean).join("–")].filter(Boolean).join(" · ")
  if (prime) {
    const introduced = depth?.record?.introducedDate ?? null
    rows.push({
      id: `p-${prime.people_id}`,
      name: prime.name,
      href: memberHref(prime.people_id, state),
      photo: prime.photo_url ?? null,
      chamber: prime.chamber ?? null,
      line: `${seat(prime)} · Sponsor`,
      detail: dated && introduced ? `Introduced ${fmtDate(introduced)}` : null,
    })
  }
  let original = 0
  let withdrawn = 0
  if (dated) {
    for (const row of cosponsors) {
      const person = row.bioguideId ? byBioguide.get(row.bioguideId.toUpperCase()) : undefined
      const peopleId = person?.people_id ?? row.people_id ?? null
      const name = person?.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.fullName || "—"
      const place = [row.party, [row.state, row.district].filter(Boolean).join("-")].filter(Boolean).join("–")
      const isOriginal = truth(row.isOriginalCosponsor)
      if (isOriginal) original += 1
      if (row.sponsorshipWithdrawnDate) withdrawn += 1
      rows.push({
        id: `c-${row.bioguideId ?? name}`,
        name,
        href: peopleId ? memberHref(peopleId, state) : null,
        photo: person?.photo_url ?? null,
        chamber: person?.chamber ?? null,
        line: [person ? honorific(person.role ?? "", person.chamber ?? "") : null, place, row.sponsorshipWithdrawnDate ? "Withdrawn" : "Co-sponsor"].filter(Boolean).join(" · "),
        detail:
          [row.sponsorshipDate ? `Joined ${fmtDate(row.sponsorshipDate)}` : null, isOriginal ? "Original" : null, row.sponsorshipWithdrawnDate ? `Withdrawn ${fmtDate(row.sponsorshipWithdrawnDate)}` : null].filter(Boolean).join(" · ") ||
          null,
      })
    }
  } else {
    for (const row of sponsors) {
      if (row === prime) continue
      rows.push({
        id: `s-${row.people_id}`,
        name: row.name,
        href: memberHref(row.people_id, state),
        photo: row.photo_url ?? null,
        chamber: row.chamber ?? null,
        line: `${seat(row)} · ${row.type === 3 ? "Joint sponsor" : "Co-sponsor"}`,
        detail: null,
      })
    }
  }
  const co = rows.length - (prime ? 1 : 0)
  const who = prime ? `${honorific(prime.role ?? "", prime.chamber ?? "")} ${prime.name}${prime.party ? ` (${prime.party})` : ""}`.trim() : null
  return (
    <>
      <H3>Sponsors</H3>
      {rows.length ? (
        <>
          <p>
            {who ? (
              <>
                <Chip>{who}</Chip> sponsors <Chip>{bill}</Chip>
                {co ? (
                  <>
                    , and {fmtNumber(co)} {co === 1 ? "member has" : "members have"} co-sponsored it
                    {dated && original ? original === co ? <>{co === 1 ? "" : ", all of them"} from the day it was introduced</> : <>, {fmtNumber(original)} of them from the day it was introduced</> : null}
                    {withdrawn ? (
                      <>
                        ; {fmtNumber(withdrawn)} {withdrawn === 1 ? "has" : "have"} since withdrawn
                      </>
                    ) : null}
                  </>
                ) : (
                  " alone"
                )}
                .
              </>
            ) : (
              <>
                {fmtNumber(rows.length)} {rows.length === 1 ? "member put their name" : "members put their names"} to <Chip>{bill}</Chip>.
              </>
            )}
          </p>
          <PreviewFrame>
            <PagedList items={rows} pageSize={10} grid render={(row) => <MemberCard key={row.id} row={row} state={state} />} />
          </PreviewFrame>
        </>
      ) : (
        <p>
          No sponsor on file for <Chip>{bill}</Chip>.
        </p>
      )}
    </>
  )
}

/* ---- votes ---------------------------------------------------------------- */

export type BillRollCall = {
  roll_call_id: number
  date: string
  chamber?: string
  description: string
  yea?: number
  nay?: number
  nv?: number
  absent?: number
  total?: number
}

/** Every roll call the bill went to, in either chamber, as a data table. */
export function BillVotesBlock({ rollCalls, bill, billNumber, state }: { rollCalls: BillRollCall[]; bill: string; billNumber: string; state: string }) {
  const rows: VoteTableRow[] = rollCalls.map((rc) => ({
    id: String(rc.roll_call_id),
    date: rc.date ?? null,
    chamber: rc.chamber ?? "",
    question: rc.description ?? "",
    yea: rc.yea ?? 0,
    nay: rc.nay ?? 0,
    nv: rc.nv ?? 0,
    absent: rc.absent ?? 0,
    // LegiScan's own page for the roll call, which lists every position.
    href: `https://legiscan.com/${state}/rollcall/${billNumber}/id/${rc.roll_call_id}`,
  }))
  const chambers = [...new Set(rows.map((r) => r.chamber).filter(Boolean))]
  return (
    <>
      <H3>Votes</H3>
      {rows.length ? (
        <>
          <p>
            <Chip>{bill}</Chip> went to {fmtNumber(rows.length)} {rows.length === 1 ? "roll call" : "roll calls"}
            {chambers.length === 1 ? <> in the {chambers[0]}</> : chambers.length > 1 ? <> across both chambers</> : null}
            {rows[0] ? (
              <>
                , the latest on {fmtDate(rows[0].date)} at {rows[0].yea}–{rows[0].nay}
              </>
            ) : null}
            .
          </p>
          <VoteTable rows={rows} />
        </>
      ) : (
        <p>
          <Chip>{bill}</Chip> has not gone to a roll call.
        </p>
      )}
    </>
  )
}

/* ---- amendments, related bills, reports, titles ---------------------------- */

const chamberOfType = (type: string | null | undefined) => (/^S/i.test(String(type ?? "")) ? "Senate" : "House")

/** Every amendment offered to the bill, on the record row, paged. */
export function BillAmendmentsBlock({ bill }: { bill: string }) {
  const c = use()
  if (!c?.onCongress || !c.amendmentTotal) return null
  const more = async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/amendments?state=US&bill=${c.billId}&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { amendments?: Amendment[] }
    return data.amendments ?? []
  }
  return (
    <>
      <H3>Amendments</H3>
      <p>
        {fmtNumber(c.amendmentTotal)} {c.amendmentTotal === 1 ? "amendment has" : "amendments have"} been offered to <Chip>{bill}</Chip>
        {c.amendments[0]?.latestAction?.actionDate ? <>, the latest acted on {fmtDate(c.amendments[0].latestAction.actionDate)}</> : null}.
      </p>
      {c.amendments.length ? (
        <PreviewFrame>
          <PagedList
            items={c.amendments}
            total={c.amendmentTotal}
            more={more}
            render={(row, index) => (
              <RecordItem
                key={`${row.type}-${row.number}-${index}`}
                stacked
                hover="rail"
                // An amendment has a page of its own now (2026-09-06).
                href={`/docs/amendments/${String(row.type ?? "HAMDT").toLowerCase()}-${row.number ?? ""}`}
                avatar={<RecordSeal state="US" chamber={row.chamber ?? chamberOfType(row.type)} ordinal={index + 1} />}
                title={`${row.type ?? ""} ${row.number ?? ""}`.trim()}
                meta={[row.latestAction?.actionDate ? fmtDate(row.latestAction.actionDate) : null, row.latestAction?.text ? truncate(row.latestAction.text, 80) : null, row.sponsors?.[0]?.fullName ?? null]}
                description={row.purpose ?? row.description ?? ""}
              />
            )}
          />
        </PreviewFrame>
      ) : (
        <p>None of their records are on file yet.</p>
      )}
    </>
  )
}

const asRelated = (row: Related): Related & { ourId: number | null } => {
  const record = row.payload ?? row
  return { ...record, ourId: row.related_bill_id ?? null, relationship: row.relationship }
}
const relationOf = (row: Related) => {
  const details = row.relationshipDetails
  if (Array.isArray(details)) return details[0]?.type ?? null
  return details?.item?.type ?? row.relationship ?? null
}

/** The bills this one travels with, as bill rows, linking here when we hold them. */
export function BillRelatedBlock({ bill }: { bill: string }) {
  const c = use()
  if (!c?.related.length) return null
  const rows = c.related.map(asRelated)
  return (
    <>
      <H3>Related bills</H3>
      <p>
        {fmtNumber(rows.length)} {rows.length === 1 ? "bill is" : "bills are"} related to <Chip>{bill}</Chip>
        {rows.length === 1 && relationOf(rows[0]) && !/^related bill$/i.test(relationOf(rows[0]) ?? "") ? <>, as {relationOf(rows[0])}</> : null}.
      </p>
      <PreviewFrame>
        <PagedList
          items={rows}
          render={(row, index) => {
            const number = `${row.type ?? ""} ${row.number ?? ""}`.trim()
            return (
              <RecordItem
                key={`${number}-${index}`}
                stacked
                hover="rail"
                external={!row.ourId}
                href={row.ourId ? `/docs/bills/${row.ourId}` : congressGovHref("bill", row.type ?? "HR", String(row.number ?? ""), row.congress ? Number(row.congress) : undefined)}
                avatar={<RecordSeal state="US" chamber={chamberOfType(row.type)} ordinal={index + 1} />}
                title={number}
                meta={[row.latestAction?.actionDate ? fmtDate(row.latestAction.actionDate) : null, row.latestAction?.text ? truncate(row.latestAction.text, 80) : null, relationOf(row)]}
                description={row.title ?? ""}
              />
            )
          }}
        />
      </PreviewFrame>
    </>
  )
}

/** The committee reports filed on the bill. */
export function BillReportsBlock({ bill }: { bill: string }) {
  const c = use()
  if (!c?.reports.length) return null
  const rows = c.reports
  return (
    <>
      <H3>Reports</H3>
      <p>
        {rows.length} committee {rows.length === 1 ? "report has" : "reports have"} been filed on <Chip>{bill}</Chip>
        {rows[0]?.citation ? (
          <>
            , the latest <Chip>{rows[0].citation}</Chip>
          </>
        ) : null}
        .
      </p>
      <ul>
        {rows.map((report) => (
          <li key={report.citation}>
            {report.url ? (
              <a href={report.url.replace("api.congress.gov/v3", "www.congress.gov")} target="_blank" rel="noopener noreferrer">
                {report.citation}
              </a>
            ) : (
              report.citation
            )}
            {report.title ? ` — ${report.title}` : ""}
          </li>
        ))}
      </ul>
    </>
  )
}

/** The names the bill goes by. */
export function BillTitlesBlock({ bill }: { bill: string }) {
  const c = use()
  if (!c?.titles.length) return null
  const short = c.titles.filter((t) => /short/i.test(t.titleType ?? "")).length
  return (
    <>
      <H3>Titles</H3>
      <p>
        <Chip>{bill}</Chip> goes by {fmtNumber(c.titles.length)} {c.titles.length === 1 ? "title" : "titles"}
        {short ? <>, {fmtNumber(short)} of them short titles</> : null}.
      </p>
      <ul>
        {c.titles.map((row, index) => (
          <li key={`${row.titleType}-${index}`}>
            <strong>{row.title}</strong>
            {row.titleType ? ` — ${row.titleType}` : ""}
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---- text ------------------------------------------------------------------ */

/** A version of a state bill's text, from `Bills.texts`, where congress.gov has no list. */
export type HeldText = { document_id: number; version: string | null; chars: number; date: string | null; source: string | null }

/** `hb6500/enrolled-bill.txt`: the file name the block wears. */
const fileName = (number: string, version: string | null | undefined) =>
  `${number.toLowerCase().replace(/[^a-z0-9]/g, "")}/${String(version ?? "text")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.txt`

/**
 * The text, in shadcn's file block, directly under the introduction's
 * sentence (Brendan, 2026-09-05): the chamber's seal where the file-type
 * glyph sits, the version as the file name, and a Versions menu at the right
 * that swaps the body for another stage — client-side, so the page stays
 * cached. The page arrives holding the newest version the site has; choosing
 * another asks for it by document. A bill we hold no text for says so, and
 * where to read it.
 */
export function BillTextBlock({
  bill,
  billNumber,
  state,
  chamber,
  held,
  text,
  texts,
  source,
}: {
  bill: string
  billNumber: string
  state: string
  chamber: string | null
  /** The document the page arrived holding. */
  held: number | null
  text: string | null
  /** LegiScan's versions, for a state bill. */
  texts: HeldText[]
  /** Where to read it when we hold nothing. */
  source: { label: string; href: string } | null
}) {
  const c = use()
  const [chosen, setChosen] = React.useState<number | null>(null)
  const { data, isLoading } = usePolicy<{ text?: string | null }>(chosen ? "text" : null, { state }, { id: c?.billId, document: chosen ?? undefined })
  // congress.gov's list where it has one — every version it lists and every
  // one we hold — else LegiScan's, newest first.
  const versions: Version[] = c?.versions.length
    ? c.versions
    : [...texts].sort((a, b) => day(b.date).localeCompare(day(a.date))).map((t) => ({ document_id: t.document_id, version: t.version, source: t.source, chars: t.chars, date: t.date, url: null }))
  const current = chosen ?? held
  const shown = versions.find((v) => v.document_id === current) ?? versions.find((v) => typeof v.document_id === "number") ?? null
  const body = chosen ? (isLoading ? null : (data?.text ?? null)) : text
  const readable = versions.filter((v) => typeof v.document_id === "number")

  if (!body && !chosen)
    return (
      <p>
        No text on file for <Chip>{bill}</Chip> yet
        {source ? (
          <>
            {" "}
            — read it at{" "}
            <a href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
            </a>
          </>
        ) : null}
        .
      </p>
    )

  const menu = readable.length > 1 && (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 px-2 font-sans text-sm text-muted-foreground hover:text-foreground">
            Versions <ChevronDown />
          </Button>
        }
      />
      {/* As wide as its widest item — "Engrossed Amendment Senate" and its
          date — so an item never wraps (Brendan, 2026-09-05). */}
      <DropdownMenuContent align="end" className="w-max min-w-44">
        {readable.map((v) => (
          <DropdownMenuCheckboxItem key={v.document_id} checked={v.document_id === current} onCheckedChange={() => setChosen(v.document_id)} className="whitespace-nowrap">
            {v.version ?? "Text"}
            {v.date ? <span className="ml-auto pl-4 text-xs text-muted-foreground">{fmtDate(v.date)}</span> : null}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <FileBlock icon={<ChamberSeal state={state} chamber={chamber} size={16} />} title={fileName(billNumber, shown?.version)} menu={menu || undefined} text={() => body ?? ""} collapsed="data-[state=closed]:max-h-96">
      {body ? <BillText text={body} /> : <p className="m-0 py-6 text-center text-sm text-muted-foreground">Loading that version…</p>}
    </FileBlock>
  )
}

/* ---- the rail ---------------------------------------------------------------- */

/**
 * The rail's contents: the sections at depth 2 and their parts at depth 3, as
 * shadcn's docs nest a command's sub-commands and as the member page does
 * (2026-09-05). It names only the parts the bill has.
 */
export function BillToc({
  session,
  committees,
}: {
  /** The record section's heading: the session's name. */
  session: string
  /** Whether LegiScan's referrals give a state bill a Committees block. */
  committees: boolean
}) {
  const c = use()
  const depth = useBillDepth()
  const toc = React.useMemo(() => {
    const items: [string, 2 | 3, string?][] = [
      ["Summary", 2],
      ["Record", 2],
      ["Text", 3],
    ]
    if (depth?.onCongress) items.push(["Tracker", 3])
    if (c?.summaries.length) items.push(["CRS Summary", 3])
    items.push(["Sponsors", 3])
    const known = depth?.committees.some((row) => row.activity && row.activity.toLowerCase() !== "unknown")
    if (known || (!depth?.committees.length && committees)) items.push(["Committees", 3])
    if (c?.reports.length) items.push(["Reports", 3])
    items.push([depth?.onCongress ? "Actions" : "History", 3], ["Votes", 3])
    if (c?.amendmentTotal) items.push(["Amendments", 3])
    if (c?.related.length) items.push(["Related bills", 3])
    if (c?.titles.length) items.push(["Titles", 3])
    if (depth?.cbo.length) items.push(["Cost estimate", 3])
    if (depth?.policyArea || depth?.subjects.length) items.push(["Classification", 2])
    if (depth?.policyArea) items.push(["CRS Subjects", 3])
    if (depth?.subjects.length) items.push(["Legislative Subjects", 3])
    if (depth?.record?.constitutionalAuthorityStatementText) items.push(["Constitutional authority", 2])
    if (depth?.record?.notes?.length) items.push(["Notes", 2])
    return items.map(([title, d, id]) => ({ title, url: `#${id ?? title.replace(/\s+/g, "-").toLowerCase()}`, depth: d }))
  }, [session, committees, c, depth])
  return <DocsTableOfContents toc={toc} />
}
