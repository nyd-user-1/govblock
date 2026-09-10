import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { getLobbyingOnBills, referredKeys } from "@/lib/policy/lobbying-queries"
import { type BillRow, getCommittees, getSessionsWithTitles, latestSession } from "@/lib/policy/db-queries"
import {
  getCommitteeBillsByStatus,
  getCommitteeCommunicationRows,
  getCommitteeHearingRows,
  getCommitteeMeetingRows,
  getCommitteeNeighbours,
  getCommitteeNominationRows,
  getCommitteePrintRows,
  getCommitteeRecord,
  getCommitteeReportRows,
  getCommitteeRoster,
  getCommitteeStatuses,
  getStateCommitteeCalendar,
  getStateCommitteeRoster,
  meetingLite,
  type RosterRow,
} from "@/lib/policy/committee-queries"
import { shortName } from "@/lib/policy/committee-slug"
import { resolveCommittee } from "@/lib/policy/committee-resolve"
import CODES from "@/lib/data/congress/committee-codes.json"
import { latestHearing } from "@/lib/policy/committee-video"
import { BackToTop } from "@/components/back-to-top"
import { Button } from "@govblock/ui/components/ny4/button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { ChamberSeal } from "@/components/policy/imagery"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { Figure, PendingSessionProvider } from "@/components/policy/pending-session"
import { SessionsMenu } from "@/components/policy/sessions-menu"
import {
  CommitteeBills,
  type CommitteeBillsTab,
  CommitteeCalendar,
  CommitteeChair,
  CommitteeCommunications,
  CommitteeHistory,
  CommitteeMeetings,
  CommitteeMembers,
  CommitteeNominations,
  CommitteeReports,
  CommitteeSubcommittees,
  CommitteeSummary,
  CommitteeToc,
} from "@/components/policy/committee-page"
import { CommitteeVideo } from "@/components/policy/committee-video"
import { LobbyingScopeBlock } from "@/components/policy/lobbying-scope"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One committee, on the member page's design (Brendan, 2026-09-06). Three
// kinds of id reach here:
//
//   hsvr00          a federal committee, by the system code congress.gov gives it
//   senate-aging    a New York committee, by the slug the Senate and Assembly sites use
//   tx-house-ways-and-means   any other state's committee, by state, chamber and name
//
// A federal page reads the congress.gov families the harvest landed; a New York
// page reads the Committees table for its chair, roster and schedule; every
// state's page reads the bills before it and the calendar. Each family fails
// on its own, so a table the harvest has not created yet leaves its block out
// rather than taking the page down.

// Rendered per request: the Sessions menu writes `?session=`, as it does on
// the member page, so the Bills block follows the session.
export const dynamic = "force-dynamic"

const CODE_MAP = CODES as { byCode: Record<string, { chamber: string; name: string }> }

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error("committee: family unavailable", error instanceof Error ? error.message : error)
    return fallback
  }
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ session?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const committee = await resolveCommittee(id)
  if (!committee) return { title: "Committee" }
  const where = committee.state === "US" ? `the U.S. ${committee.chamber}` : `the ${stateName(committee.state)} ${committee.chamber}`
  return { title: committee.title, description: `${committee.title} of ${where}: members, the bills before it, its meetings and what it filed.` }
}

export default async function CommitteeRoute({ params, searchParams }: Props) {
  const { id } = await params
  const committee = await resolveCommittee(id)
  if (!committee) notFound()
  const { state, kind, record, ny, legiscanName, title } = committee
  const federal = kind === "federal"

  // The session: asked for, else the latest the jurisdiction has bills in.
  const latest = await latestSession(state)
  const asked = Number((await searchParams).session)
  const sessions = await safe(() => getSessionsWithTitles(state), [] as { session_id: number; title: string | null }[])
  const session = Number.isFinite(asked) && asked > 0 && sessions.some((r) => Number(r.session_id) === asked) ? asked : latest
  const nameOf = (year: number) => {
    if (state === "US") return congressName(year)
    const row = sessions.find((r) => Number(r.session_id) === year)
    return (
      row?.title
        ?.replace(/\s*(Regular|General)\s+Session$/i, "")
        .replace(/\s*Session$/i, "")
        .trim() || String(year)
    )
  }
  const sessionOptions = sessions.map((r) => ({ value: Number(r.session_id), label: nameOf(Number(r.session_id)) }))
  const f = { state, session }
  const code = committee.id

  const [statuses, recent, counts, roster, hearings, meetings, reports, prints, nominations, communications, neighbours, calendar, video, lobbying] = await Promise.all([
    safe(() => getCommitteeStatuses(f, legiscanName), [] as { status: string; bills: number }[]),
    safe(() => getCommitteeBillsByStatus(f, legiscanName, null, 25, 0), { rows: [] as BillRow[], total: 0 }),
    safe(() => getCommittees(f), [] as { committee_name: string; chamber: string; bills: number }[]),
    federal ? safe(() => getCommitteeRoster(code), [] as RosterRow[]) : ny ? safe(() => getStateCommitteeRoster(ny.members, ny.chair, ny.chamber), [] as RosterRow[]) : Promise.resolve([] as RosterRow[]),
    federal ? safe(() => getCommitteeHearingRows(code), []) : Promise.resolve([]),
    federal ? safe(() => getCommitteeMeetingRows(code), []) : Promise.resolve([]),
    federal ? safe(() => getCommitteeReportRows(code), []) : Promise.resolve([]),
    federal ? safe(() => getCommitteePrintRows(code), []) : Promise.resolve([]),
    federal && committee.chamber === "Senate" ? safe(() => getCommitteeNominationRows(code, 25, 0), { rows: [], total: 0 }) : Promise.resolve({ rows: [], total: 0 }),
    federal ? safe(() => getCommitteeCommunicationRows(code, 25, 0), { rows: [], total: 0 }) : Promise.resolve({ rows: [], total: 0 }),
    federal ? safe(() => getCommitteeNeighbours(code), { previous: null, next: null }) : Promise.resolve({ previous: null, next: null }),
    // Every jurisdiction's calendar, Congress included: the bills calendared
    // before the committee feed the Upcoming tab.
    safe(() => getStateCommitteeCalendar(f, legiscanName), []),
    federal ? latestHearing(code).catch(() => ({ kind: "unmapped" as const })) : Promise.resolve({ kind: "unmapped" as const }),
    // Lobbying on the bills referred to this room. Federal only: the LDA is a
    // federal statute and its filings cite congress.gov's own bills.
    federal ? referredKeys(code).then((keys) => getLobbyingOnBills(keys)).catch(() => null) : Promise.resolve(null),
  ])

  // The bills, a tab per status: the 25 newest split by status are each
  // status's own newest rows, so every tab opens on real rows and pages on.
  const tabs: CommitteeBillsTab[] = statuses.map((s) => ({
    status: s.status,
    count: s.bills,
    rows: recent.rows.filter((b) => (b.status_desc || "Introduced") === s.status),
  }))
  const referred = statuses.reduce((sum, s) => sum + s.bills, 0)
  // Bills per subcommittee this session, keyed by system code through the
  // name map, for the subcommittee cards.
  const subCounts = new Map<string, number>()
  for (const sub of record?.subcommittees ?? []) {
    const mapped = CODE_MAP.byCode[sub.code]
    const hit = mapped ? counts.find((c) => c.committee_name === mapped.name) : null
    if (hit) subCounts.set(sub.code, hit.bills)
  }
  // The name the sentences use: "Veterans' Affairs", never "Veterans' Affairs Committee has".
  const who = federal ? shortName(record?.name ?? title) : legiscanName
  const chamberLabel = state === "US" ? `U.S. ${committee.chamber}` : `${stateName(state)} ${committee.chamber}`
  const facts = [
    chamberLabel,
    record?.parent ? `Subcommittee of ${shortName(record.parent.name)}` : (record?.type ?? ny?.type ?? null),
    record && !record.isCurrent ? "Former" : null,
    ny?.schedule ? `Meets ${ny.schedule.charAt(0).toUpperCase() + ny.schedule.slice(1).toLowerCase()}` : null,
  ]
  const description = `${title}, ${chamberLabel}. ${fmtNumber(referred)} bills before it this session.`
  const markdown = [`# ${title}`, "", description].join("\n")
  const arrow = "extend-touch-target size-8 shadow-none md:size-7"
  const menu = sessionOptions.length > 1 ? <SessionsMenu sessions={sessionOptions} current={session} /> : undefined

  const parts: string[] = []
  if (roster.length) parts.push("Members")
  if (record?.subcommittees.length) parts.push("Subcommittees")
  parts.push("Bills")
  if (federal && (meetings.length || hearings.length)) parts.push("Meetings")
  if (!federal && calendar.length) parts.push("Hearings")
  if (reports.length || prints.length) parts.push("Reports")
  if (nominations.total) parts.push("Nominations")
  if (communications.total) parts.push("Communications")
  if (lobbying) parts.push("Lobbying")

  return (
    <PendingSessionProvider>
      <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-(--top-spacing) shrink-0" />
          <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
            <RecordHeader
              media={<ChamberSeal state={state} chamber={committee.chamber} size={RECORD_MEDIA} />}
              title={title}
              meta={facts}
              action={
                <>
                  <DocsCopyPage page={markdown} url={`https://gov.nysgpt.com/committees/${code}`} />
                  {neighbours.previous ? (
                    <Button variant="secondary" size="icon" className={arrow} asChild>
                      <Link href={`/committees/${neighbours.previous.key}`} title={neighbours.previous.name}>
                        <IconArrowLeft />
                        <span className="sr-only">Previous committee</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="icon" className={arrow} asChild>
                      <Link href={`/committees?state=${state}`}>
                        <IconArrowLeft />
                        <span className="sr-only">All committees</span>
                      </Link>
                    </Button>
                  )}
                  {neighbours.next ? (
                    <Button variant="secondary" size="icon" className={arrow} asChild>
                      <Link href={`/committees/${neighbours.next.key}`} title={neighbours.next.name}>
                        <IconArrowRight />
                        <span className="sr-only">Next committee</span>
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
              {/* h1 the name, h2 Summary and Record, h3 the parts — the
                  standard on every detail page (Brendan, 2026-09-05). */}
              <H2>Summary</H2>
              {ny ? (
                <>
                  <p>
                    {ny.description ? `${ny.description.replace(/\.?$/, "")}. ` : null}
                    <Chip>{who}</Chip> is a {ny.type ? ny.type.toLowerCase() : "standing"} committee of the {stateName(state)} {ny.chamber}
                    {roster.length ? <> with {roster.length} members</> : null}. It has <Figure>{fmtNumber(referred)}</Figure> {referred === 1 ? "bill" : "bills"} before it this session.
                  </p>
                </>
              ) : federal ? (
                <CommitteeSummary record={record} roster={roster} bills={referred} state={state} who={who} hearings={hearings.length} reports={reports.length} />
              ) : (
                <p>
                  <Chip>{who}</Chip> is a committee of the {stateName(state)} {committee.chamber}. It has <Figure>{fmtNumber(referred)}</Figure> {referred === 1 ? "bill" : "bills"} before it this session.
                </p>
              )}

              {/* The H2 after the rule is Chair, with the chair's paragraph
                  under it and the record's sentence after that (Brendan's
                  image, 2026-09-06). */}
              <hr />
              <H2>Chair</H2>
              <CommitteeChair record={record} roster={roster} state={state} website={ny?.url ?? null} />
              <p>
                <Chip>{who}</Chip> has <Figure>{fmtNumber(referred)}</Figure> {referred === 1 ? "bill" : "bills"}
                {federal ? (
                  <>
                    , {fmtNumber(hearings.length + meetings.length)} {hearings.length + meetings.length === 1 ? "meeting" : "meetings"} and {fmtNumber(reports.length)} {reports.length === 1 ? "report" : "reports"}
                  </>
                ) : calendar.length ? (
                  <>
                    {" "}
                    and {fmtNumber(calendar.length)} {calendar.length === 1 ? "hearing" : "hearings"}
                  </>
                ) : null}{" "}
                on the record this session.
              </p>

              <CommitteeMembers roster={roster} state={state} who={who} />
              <CommitteeSubcommittees record={record} counts={subCounts} state={state} />
              <CommitteeBills tabs={tabs} name={legiscanName} state={state} session={session} who={who} menu={menu} />
              {federal && <CommitteeMeetings meetings={meetings.map(meetingLite)} hearings={hearings} calendar={calendar} who={who} />}
              {!federal && <CommitteeCalendar rows={calendar} who={who} state={state} chamber={committee.chamber} />}
              <CommitteeReports reports={reports} prints={prints} who={who} />
              <CommitteeNominations rows={nominations.rows} total={nominations.total} code={code} who={who} state={state} />
              <CommitteeCommunications rows={communications.rows} total={communications.total} code={code} who={who} state={state} />
              <LobbyingScopeBlock data={lobbying} who={who} what="referred to" />

              <CommitteeHistory record={record} />
              {ny && (ny.address || ny.chair_email) && (
                <>
                  <hr />
                  <H2>Contact</H2>
                  <p>
                    {ny.address ? `${ny.address}. ` : null}
                    {ny.chair_email ? (
                      <>
                        The chair's office answers at <a href={`mailto:${ny.chair_email}`}>{ny.chair_email}</a>.
                      </>
                    ) : null}
                  </p>
                </>
              )}
            </div>
            {(neighbours.previous || neighbours.next) && (
              <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
                {neighbours.previous && (
                  <Button variant="secondary" size="sm" className="shadow-none" asChild>
                    <Link href={`/committees/${neighbours.previous.key}`}>
                      <IconArrowLeft /> {shortName(neighbours.previous.name)}
                    </Link>
                  </Button>
                )}
                {neighbours.next && (
                  <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                    <Link href={`/committees/${neighbours.next.key}`}>
                      {shortName(neighbours.next.name)} <IconArrowRight />
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
          <div className="scrollbar-none flex scroll-fade flex-col gap-8 overflow-y-auto px-8">
            {federal && <CommitteeVideo latest={video} />}
            <CommitteeToc parts={parts} history={!!record?.history.length} />
          </div>
          <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
            <PublicRail />
          </div>
        </div>
      </div>
    </PendingSessionProvider>
  )
}
