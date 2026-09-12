import { typesetHref } from "@/lib/typeset/views"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { BILLS } from "@/lib/data"
import { getBill, getBillText } from "@/lib/policy/queries"
import {
  getAmendments,
  getBillActions,
  getBillCommittees,
  getBillNeighbours,
  getBillRecord,
  getBillSubjects,
  getCboEstimates,
  getCommittees,
  getCommitteeReports,
  getCosponsors,
  getSessionsWithTitles,
  getLaws,
  getPolicyAreas,
  getRelatedBills,
  getSummaries,
  getTextVersions,
  getTitles,
} from "@/lib/policy/db-queries"
import { fmtBill } from "@/lib/format"
import { billCongressKey, congressName } from "@/lib/policy/congress"
import { getBillLobbying } from "@/lib/policy/lobbying-queries"
import { getBillRollCalls } from "@/lib/policy/roll-call-queries"
import { isJurisdiction, stateName } from "@/lib/filters"
import { BackToTop } from "@/components/back-to-top"
import { BillsJurisdictionPage, jurisdictionTitle } from "@/components/bills-jurisdiction-page"
import { ChamberSeal } from "@/components/policy/imagery"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { Button } from "@govblock/ui/components/ny4/button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { PreviewFrame } from "@/components/preview-frame"
import {
  BillAmendmentsBlock,
  BillCongressProvider,
  type BillFacts,
  BillRecordLead,
  BillRelatedBlock,
  BillReportsBlock,
  BillSponsorsBlock,
  BillSummaries,
  BillSummaryLead,
  BillTextBlock,
  BillTitlesBlock,
  BillToc,
  BillVotesBlock,
  type CongressInitial,
} from "@/components/policy/bill-congress"
import {
  BillActionsBlock,
  BillCommitteesBlock,
  BillCostEstimates,
  BillDepthProvider,
  BillNotes,
  BillSubjects,
  BillTracker,
  type DepthInitial,
} from "@/components/policy/bill-depth"
import { BillLobbyingBlock } from "@/components/policy/bill-lobbying"
import { H2, H3 } from "@/components/typeset"

// A bill's own page, on the member page's design (2026-09-05): the session's
// heading over the sentence, the text, the Tracker and the CRS Summary; the
// rule; the session again as the record — Sponsors, Committees, Reports,
// Actions, Votes, Amendments, Related bills, Titles, Cost estimate — then
// Classification, and the constitutional authority statement last. One derived sentence under every heading; every
// list, table and grid in the same frame.
//
// Every bill in the policy database has a page. The twelve committed under
// lib/data are prerendered at build time and stand in if the database is
// unreachable; the rest render on demand and are then cached.

const day = (value: unknown) => (value ? String(value).slice(0, 10) : "")
const host = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "")
  } catch {
    return href
  }
}

// A bill's record changes under it — an action, a cosponsor, and above all a new
// text version as it moves. The twelve prerendered here would otherwise be
// frozen at build time: HB10160's introduced text landed in Aurora and the page
// still said "No text on file yet", because nothing asked it again. The rest of
// the app already revalidates hourly.
//
// No search params are read here, on purpose: the Versions menu switches in
// the browser, so the page stays cached (the member page paid for `?session=`
// with per-request rendering).
export const revalidate = 3600

export function generateStaticParams() {
  return Object.keys(BILLS).map((id) => ({ id }))
}

// The session's name: "119th Congress", or the state's own title with the
// word "Session" taken off, as the member page names it.
const sessionName = (state: string, session: number, title: string | null) =>
  state === "US" ? congressName(session) : (title ?? "").replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "").trim() || String(session)

/**
 * What congress.gov holds about a federal bill, fetched on the server so the
 * blocks render with the page rather than popping in. Each family fails on its
 * own: a build with no database gets nulls, and the browser reads those
 * families as it always did.
 */
async function loadCongress(billId: number): Promise<{ congress: CongressInitial; depth: DepthInitial }> {
  const safe = async <T,>(read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read()
    } catch (error) {
      console.error("bill: congress.gov family unavailable", error)
      return null
    }
  }
  const [versions, summaries, amendments, related, titles, reports, cosponsors, laws, actions, record, committees, subjects, cbo, policyAreas] = await Promise.all([
    safe(() => getTextVersions(billId)),
    safe(() => getSummaries(billId)),
    safe(() => getAmendments(100, 0, billId)),
    safe(() => getRelatedBills(billId)),
    safe(() => getTitles(billId)),
    safe(() => getCommitteeReports(50, 0, billId)),
    safe(() => getCosponsors(billId)),
    safe(() => getLaws(250, 0, billId)),
    safe(() => getBillActions(billId, 500)),
    safe(() => getBillRecord(billId)),
    safe(() => getBillCommittees(billId)),
    safe(() => getBillSubjects(billId)),
    safe(() => getCboEstimates(billId)),
    safe(() => getPolicyAreas()),
  ])
  return {
    congress: {
      versions: (versions as CongressInitial["versions"]) ?? null,
      summaries: (summaries?.summaries as CongressInitial["summaries"]) ?? null,
      amendments: amendments ? { count: amendments.count, amendments: amendments.amendments as NonNullable<CongressInitial["amendments"]>["amendments"] } : null,
      related: (related?.relatedBills as CongressInitial["related"]) ?? null,
      titles: (titles?.titles as CongressInitial["titles"]) ?? null,
      reports: (reports?.reports as CongressInitial["reports"]) ?? null,
      cosponsors: (cosponsors?.cosponsors as CongressInitial["cosponsors"]) ?? null,
      laws: (laws?.bills as CongressInitial["laws"]) ?? null,
    },
    depth: {
      actions: actions ? { count: actions.count, actions: actions.actions as NonNullable<DepthInitial["actions"]>["actions"] } : null,
      record: (record?.record as DepthInitial["record"]) ?? null,
      committees: (committees?.committees as DepthInitial["committees"]) ?? null,
      subjects: (subjects?.subjects as DepthInitial["subjects"]) ?? null,
      cbo: (cbo?.cboCostEstimates as DepthInitial["cbo"]) ?? null,
      policyAreas: policyAreas ?? null,
    },
  }
}

// /bills/ny is a jurisdiction's bills page, not a bill (Brendan, 2026-09-11);
// the segment is a two-letter code there and a number everywhere else.
const jurisdictionOf = (id: string) => (/^[a-z]{2}$/i.test(id) && isJurisdiction(id) ? id.toUpperCase() : null)

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const code = jurisdictionOf(id)
  if (code) return { title: `${jurisdictionTitle(code)} Bills`, description: `The bills most recently acted on in ${jurisdictionTitle(code)}, each with its full text.` }
  const bill = await getBill(Number(id))
  if (!bill) return { title: "Bill" }
  return { title: bill.citation ?? fmtBill(bill.bill_number, bill.state), description: bill.description || bill.title }
}

export default async function BillRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const code = jurisdictionOf(id)
  if (code) return <BillsJurisdictionPage state={code} />
  const bill = await getBill(Number(id))
  if (!bill) notFound()
  const federal = bill.state === "US"
  // The LDA is a federal statute, so lobbying is asked for only under Congress,
  // and on congress.gov's own key rather than the mirror's id — see
  // docs/federal-sources.md and sql/002_lobbying_congress_key.sql.
  const congressKey = federal ? billCongressKey(bill.bill_number, bill.session_id) : null
  const [held, { congress, depth }, neighbours, committeeCounts, sessions, lobbying, federalVotes] = await Promise.all([
    getBillText(Number(id)),
    federal ? loadCongress(bill.bill_id) : Promise.resolve<{ congress: CongressInitial; depth: DepthInitial }>({ congress: {}, depth: {} }),
    getBillNeighbours(bill.bill_id).catch(() => ({ previous: null, next: null })),
    getCommittees({ state: bill.state, session: bill.session_id }).catch(() => []),
    // A New York row carries no session title of its own; the session list does.
    !federal && !bill.session_title ? getSessionsWithTitles(bill.state).catch(() => []) : Promise.resolve([]),
    federal ? getBillLobbying({ congressKey, billId: bill.bill_id }).catch(() => null) : Promise.resolve(null),
    // Both chambers, from our own record: the mirror carries House votes only
    // and sends the reader to legiscan.com for the positions.
    federal ? getBillRollCalls(bill.bill_id, congressKey).catch(() => []) : Promise.resolve([]),
  ])
  const text = held?.text ?? null
  // Congress is cited the way congress.gov writes it: getBill carries the
  // citation off congress_bills, and the mirror's prefix is only the fallback.
  const number = bill.citation ?? fmtBill(bill.bill_number, bill.state)
  const summary = bill.description || bill.title
  const sessionTitle = bill.session_title ?? sessions.find((r) => Number(r.session_id) === bill.session_id)?.title ?? null
  const session = sessionName(bill.state, bill.session_id, sessionTitle)
  // The chamber: the row's, else the sponsor's, else the number's own letter —
  // a New York row carries none, and A 11709 is an Assembly bill.
  const chamber = bill.body ?? bill.sponsors[0]?.chamber ?? ({ A: "Assembly", S: "Senate", H: "House" } as Record<string, string>)[bill.bill_number.slice(0, 1)] ?? null

  const sources: { label: string; href: string }[] = []
  if (bill.state_link) sources.push({ label: host(bill.state_link), href: bill.state_link })
  if (bill.url) sources.push({ label: host(bill.url), href: bill.url })

  const facts: BillFacts = {
    number,
    // The title always rides in the sentence now that the head carries only
    // the facts; the sentence phrases it by its shape.
    title: bill.title ?? "",
    chamber,
    status: bill.status_desc ?? null,
    lastAction: bill.last_action ?? null,
    lastActionDate: bill.last_action_date ? day(bill.last_action_date) : null,
    committee: bill.committee ?? null,
    introduced: bill.history[0]?.date ? day(bill.history[0].date) : null,
    sponsors: bill.sponsors,
    rollCalls: bill.rollCalls.length,
  }

  const markdown = [`# ${number}`, "", summary, "", `**${bill.status_desc ?? "—"}**${bill.last_action_date ? ` · last action ${day(bill.last_action_date)}: ${bill.last_action ?? ""}` : ""}`, "", "## Introduction", "", summary].join("\n")
  const arrow = "extend-touch-target size-8 shadow-none md:size-7"

  return (
    <BillCongressProvider billId={bill.bill_id} billNumber={bill.bill_number} state={bill.state} initial={congress}>
      <BillDepthProvider billId={bill.bill_id} state={bill.state} initial={depth}>
        <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-(--top-spacing) shrink-0" />
            <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
              <RecordHeader
                media={<ChamberSeal state={bill.state} chamber={chamber} size={RECORD_MEDIA} />}
                title={number}
                meta={[chamber ? (federal ? `U.S. ${chamber}` : `${stateName(bill.state)} ${chamber}`) : null, bill.status_desc ?? null]}
                action={
                  <>
                    <DocsCopyPage
                      page={markdown}
                      url={`https://gov.nysgpt.com/bills/${bill.bill_id}`}
                      typeset={typesetHref(bill.bill_id)}
                      // Only when there are printings to compare — sponsor memos are not printings.
                      diff={(bill.texts ?? []).filter((t) => !/memo/i.test(t.version ?? "")).length > 1 ? typesetHref(bill.bill_id, "comp") : undefined}
                      git={typesetHref(bill.bill_id, "git")}
                    />
                    {/* The neighbouring bills in the session, as shadcn's docs
                        header pages to the next document. */}
                    {neighbours.previous ? (
                      <Button variant="secondary" size="icon" className={arrow} asChild>
                        <Link href={`/bills/${neighbours.previous.bill_id}`} title={fmtBill(neighbours.previous.bill_number, bill.state)}>
                          <IconArrowLeft />
                          <span className="sr-only">Previous bill</span>
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="secondary" size="icon" className={arrow} disabled>
                        <IconArrowLeft />
                      </Button>
                    )}
                    {neighbours.next ? (
                      <Button variant="secondary" size="icon" className={arrow} asChild>
                        <Link href={`/bills/${neighbours.next.bill_id}`} title={fmtBill(neighbours.next.bill_number, bill.state)}>
                          <IconArrowRight />
                          <span className="sr-only">Next bill</span>
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="secondary" size="icon" className={arrow} disabled>
                        <IconArrowRight />
                      </Button>
                    )}
                  </>
                }
              />
              <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
                {/* h1 the number, h2 Summary and Record, h3 the parts — Brendan,
                    2026-09-05: "note the progression, h1, h2, h3". Summary is
                    the one sentence; Record opens on Text. */}
                <H2>Summary</H2>
                <BillSummaryLead facts={facts} />

                <hr />
                <H2>Record</H2>
                <H3>Text</H3>
                <BillRecordLead facts={facts} />
                <BillTextBlock
                  bill={number}
                  billNumber={bill.bill_number}
                  state={bill.state}
                  chamber={chamber}
                  held={held?.document_id ?? null}
                  text={text}
                  texts={bill.texts}
                  source={sources[0] ?? null}
                />
                {federal && (
                  <>
                    <H3>Tracker</H3>
                    <p>The tracker indicates the progress of this legislation as it moves through the legislative process.</p>
                    <PreviewFrame>
                      <BillTracker framed />
                    </PreviewFrame>
                  </>
                )}
                <BillSummaries fallback={<p>{summary}</p>} chamber={chamber} />

                <BillSponsorsBlock sponsors={bill.sponsors} state={bill.state} bill={number} />
                <BillCommitteesBlock bill={number} state={bill.state} referrals={bill.referrals} counts={committeeCounts} />
                <BillReportsBlock bill={number} />
                <BillActionsBlock history={bill.history} rollCalls={bill.rollCalls} bill={number} />
                <BillVotesBlock rollCalls={bill.rollCalls} federal={federalVotes} bill={number} billNumber={bill.bill_number} state={bill.state} />
                <BillAmendmentsBlock bill={number} />
                <BillRelatedBlock bill={number} />
                <BillTitlesBlock bill={number} />
                <BillCostEstimates bill={number} />

                <BillLobbyingBlock bill={number} data={lobbying} />

                <BillSubjects bill={number} chamber={chamber} state={bill.state} />
                <BillNotes bill={number} />

                {sources.length > 0 && (
                  <>
                    <hr />
                    <p>
                      Source:{" "}
                      {sources.map((link, index) => (
                        <span key={link.href}>
                          {index > 0 && " · "}
                          <a href={link.href} target="_blank" rel="noopener noreferrer">
                            {link.label}
                          </a>
                        </span>
                      ))}
                    </p>
                  </>
                )}
              </div>
              {(neighbours.previous || neighbours.next) && (
                <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
                  {neighbours.previous && (
                    <Button variant="secondary" size="sm" className="shadow-none" asChild>
                      <Link href={`/bills/${neighbours.previous.bill_id}`}>
                        <IconArrowLeft /> {fmtBill(neighbours.previous.bill_number, bill.state)}
                      </Link>
                    </Button>
                  )}
                  {neighbours.next && (
                    <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                      <Link href={`/bills/${neighbours.next.bill_id}`}>
                        {fmtBill(neighbours.next.bill_number, bill.state)} <IconArrowRight />
                      </Link>
                    </Button>
                  )}
                </div>
              )}
              <BackToTop />
            </div>
          </div>
          <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
            <div className="h-(--top-spacing) shrink-0"></div>
            <div className="flex scroll-fade scrollbar-none flex-col gap-8 overflow-y-auto px-8">
              <BillToc session={session} committees={bill.referrals.length > 0} lobbying={!!lobbying?.summary.filings} />
            </div>
            <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
              <PublicRail />
            </div>
          </div>
        </div>
      </BillDepthProvider>
    </BillCongressProvider>
  )
}
