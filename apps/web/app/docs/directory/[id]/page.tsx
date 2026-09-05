import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { stateName } from "@/lib/filters"
import { fmtNumber, honorific } from "@/lib/format"
import { getCommittees, getFec, getMember, getMemberCareer, getMemberCommittees, getMemberDetail, getMemberDirectory, getMemberNeighbours, getMemberRecord, getMemberState, getSessionsWithTitles, latestSession } from "@/lib/policy/db-queries"
import { congressName } from "@/lib/policy/congress"
import { BackToTop } from "@/components/back-to-top"
import { Button } from "@govblock/ui/components/ny4/button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { MemberFeed } from "@/components/policy/member-feed"
import { MemberHeader, MemberIntroduction } from "@/components/policy/member-page"
import { MemberCommittees } from "@/components/policy/member-committees"
import { MemberOffices, MemberStaff } from "@/components/policy/member-directory"
import { officePlaces } from "@/lib/policy/office-places"
import { MemberTabs } from "@/components/policy/member-tabs"
import { PreviewFrame } from "@/components/preview-frame"
import { SessionsMenu } from "@/components/policy/sessions-menu"
import {
  MemberCongressProvider,
  MemberContact,
  MemberFinance,
  MemberToc,
  MemberVotes,
} from "@/components/policy/member-congress"
import { H2, H3 } from "@/components/typeset"

// A member's own page, keyed by `people_id` — globally unique, so the route
// learns the jurisdiction from the person rather than the other way round.
// Ported from livingston-v3 app/(app)/docs/members/[id]/page.tsx into the docs
// shell the bill page uses; `memberHref` has pointed here since the directory
// landed, and until today it went nowhere.
//
// Rendered on the server. The path names exactly one person, so a shared link,
// a crawler and a reader with slow JS all see who it is. The portrait, the
// terms and the floor votes arrive from congress.gov after that.


// "Congress House" is not a thing anyone says, and it is the one place this
// page would print the jurisdiction into a shell every reader shares.
const chamberName = (state: string, chamber: string) =>
  state === "US" ? `U.S. ${chamber}` : `${stateName(state)} ${chamber}`

// Rendered per request: the Sessions menu writes `?session=`, and a page that
// reads a search param cannot also be cached and pre-generated — in
// production the route failed before rendering when it tried (2026-09-05,
// every member page a 500). The auth page reads its params the same way.
export const dynamic = "force-dynamic"

async function load(id: string, wanted?: string) {
  const peopleId = Number(id)
  if (!Number.isFinite(peopleId) || peopleId <= 0) return null
  const state = await getMemberState(peopleId)
  if (!state) return null
  // The Sessions menu on every block writes `?session=`; the page opens on it
  // when the member appears in it, else on the latest (Brendan, 2026-09-05).
  const latest = await latestSession(state)
  const asked = Number(wanted)
  const careerAhead = Number.isFinite(asked) && asked > 0 ? await getMemberCareer(peopleId, state) : null
  const session = careerAhead && careerAhead.sessions.includes(asked) ? asked : latest
  // FEC totals are a federal record; a state seat files with its own board,
  // so the section exists only under Congress and says so when it is empty.
  // The directories are federal too: the House Telephone Directory for a
  // representative's offices and staff, senate.gov's contact record for a
  // senator. A state seat has neither.
  const [member, record, fec, directory, career, sessions, neighbours] = await Promise.all([
    getMember(peopleId, session),
    getMemberRecord({ state, session }, peopleId, 20),
    state === "US" ? getFec(peopleId) : Promise.resolve(null),
    state === "US" ? getMemberDirectory(peopleId) : Promise.resolve(null),
    careerAhead ?? getMemberCareer(peopleId, state),
    state === "US" ? Promise.resolve([]) : getSessionsWithTitles(state),
    getMemberNeighbours({ state, session }, peopleId),
  ])
  if (!member) return null
  // The record's heading is the session's name: "119th Congress", or a
  // state's own title for it (Brendan, 2026-09-05: Record → "119th Congress").
  const nameOf = (year: number) => {
    if (state === "US") return congressName(year)
    const row = sessions.find((r) => Number(r.session_id) === year)
    return row?.title?.replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "").trim() || String(year)
  }
  const sessionName = nameOf(session)
  const sessionOptions = career.sessions.map((year) => ({ value: year, label: nameOf(year) }))
  // The terms served, for the introduction's "for seven terms": congress.gov's
  // list, one entry per Congress. A state seat has no such record.
  const bioguideId = (member as Record<string, unknown>).bioguide_id
  const [detail, committees, committeeCounts] = await Promise.all([
    state === "US" && bioguideId ? getMemberDetail(String(bioguideId)) : Promise.resolve(null),
    state === "US" && bioguideId ? getMemberCommittees(String(bioguideId)) : Promise.resolve([]),
    state === "US" && bioguideId ? getCommittees({ state, session }) : Promise.resolve([]),
  ])
  const termList = (detail?.member as { terms?: { chamber?: string; startYear?: number }[] | { item?: { chamber?: string; startYear?: number }[] } } | undefined)?.terms
  const terms = Array.isArray(termList) ? termList : (termList?.item ?? [])
  // `getMember` selects the whole `"People"` row; the spread in its return
  // narrows the type back to the columns it names, so the rest are read here
  // the way the query fetched them.
  return { peopleId, state, session, member: member as typeof member & Record<string, unknown>, record, fec, directory, terms, committees, committeeCounts, career, sessionName, sessionOptions, neighbours }
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ session?: string }> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await load(id, (await searchParams).session)
  if (!data) return { title: "Member" }
  const { member, state } = data
  const title = `${honorific(String(member.role ?? ""), String(member.chamber ?? ""))} ${member.name}`.trim()
  return {
    title,
    description: `${title} — ${chamberName(state, String(member.chamber ?? ""))}. Sponsored bills, aye and nay votes.`,
  }
}

export default async function MemberRoute({ params, searchParams }: Props) {
  const { id } = await params
  const data = await load(id, (await searchParams).session)
  if (!data) notFound()
  const { peopleId, state, member, record, fec, directory, terms, committees, committeeCounts, career, sessionName, sessionOptions, session, neighbours } = data

  const name = String(member.name ?? "")
  const title = `${honorific(String(member.role ?? ""), String(member.chamber ?? ""))} ${name}`.trim()
  const bioguide = member.bioguide_id ? String(member.bioguide_id) : null
  const biography = typeof member.bio_long === "string" ? member.bio_long : ""
  const fecIds = member.fec_candidate_ids
  const fecId = Array.isArray(fecIds) && fecIds.length ? String(fecIds[0]) : null
  const description = [
    member.leadership_title ? String(member.leadership_title) : null,
    member.district ? String(member.district).replace(/^[A-Z]+-0*/, "District ") : null,
    chamberName(state, String(member.chamber ?? "")),
  ]
    .filter(Boolean)
    .join(" · ")
  const markdown = [`# ${title}`, "", description, "", `${record.counts.prime} prime · ${record.counts.cosponsor} co-sponsored · ${record.counts.aye} aye · ${record.counts.nay} nay`].join("\n")

  return (
    <MemberCongressProvider peopleId={peopleId} bioguide={bioguide} state={state} who={title}>
      <BackToTop />
      <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-(--top-spacing) shrink-0" />
          <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
            {/* The Copy Page control rides inside the header so the name
                top-aligns with it, the way /docs/bills does — it used to sit in
                a row of its own with the portrait block below. */}
            <MemberHeader
              peopleId={peopleId}
              state={state}
              member={member}
              action={
                <DocsCopyPage page={markdown} url={`https://govblock.app/docs/directory/${peopleId}`} />
              }
            />
            <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
              <H2>Introduction</H2>
              <MemberIntroduction member={member} state={state} career={career} terms={terms} />

              <hr />
              <H2 id="record">{sessionName}</H2>
              <p>
                {title} is the prime sponsor of <code>{fmtNumber(record.counts.prime)}</code> {record.counts.prime === 1 ? "bill" : "bills"} and a co-sponsor of{" "}
                <code>{fmtNumber(record.counts.cosponsor)}</code> this session.
              </p>
              <H3>Bills</H3>
              <PreviewFrame>
                <MemberTabs
                  menu={<SessionsMenu sessions={sessionOptions} current={session} />}
                  tabs={[
                    {
                      value: "prime",
                      label: "Sponsored",
                      emoji: "😀",
                      count: record.counts.prime,
                      content: (
                        <MemberFeed
                          bills={record.prime}
                          total={record.counts.prime}
                          state={state}
                          peopleId={peopleId}
                          session={session}
                          kind="prime"
                          pageSize={5}
                          empty={`${name} has sponsored nothing this session.`}
                        />
                      ),
                    },
                    {
                      value: "cosponsor",
                      label: "Co-Sponsored",
                      emoji: "🤝",
                      count: record.counts.cosponsor,
                      content: (
                        <MemberFeed
                          bills={record.cosponsor}
                          total={record.counts.cosponsor}
                          state={state}
                          peopleId={peopleId}
                          session={session}
                          kind="cosponsor"
                          pageSize={5}
                          empty={`${name} has co-sponsored nothing this session.`}
                        />
                      ),
                    },
                  ]}
                />
              </PreviewFrame>

              <MemberCommittees committees={committees} counts={committeeCounts} who={title} menu={<SessionsMenu sessions={sessionOptions} current={session} />} />
              <MemberFinance totals={(fec?.totals ?? []).map((row) => ({ ...row, fecId: fecId }))} />

              <MemberVotes menu={<SessionsMenu sessions={sessionOptions} current={session} />} />

              <H3>Votes</H3>
              <p>
                {title} has voted Yes on <code>{fmtNumber(record.counts.aye)}</code> bills and No on <code>{fmtNumber(record.counts.nay)}</code> this session.
              </p>
              <PreviewFrame>
                <MemberTabs
                  menu={<SessionsMenu sessions={sessionOptions} current={session} />}
                  tabs={[
                    {
                      value: "aye",
                      label: "Aye",
                      emoji: "✅",
                      count: record.counts.aye,
                      content: (
                        <MemberFeed
                          bills={record.aye}
                          total={record.counts.aye}
                          vote="Aye"
                          state={state}
                          peopleId={peopleId}
                          session={session}
                          kind="aye"
                          pageSize={5}
                          empty="No recorded aye votes this session."
                        />
                      ),
                    },
                    {
                      value: "nay",
                      label: "Nay",
                      emoji: "❌",
                      count: record.counts.nay,
                      content: (
                        <MemberFeed
                          bills={record.nay}
                          total={record.counts.nay}
                          vote="Nay"
                          state={state}
                          peopleId={peopleId}
                          session={session}
                          kind="nay"
                          pageSize={5}
                          empty="No recorded nay votes this session."
                        />
                      ),
                    },
                  ]}
                />
              </PreviewFrame>

              <MemberContact
                senate={directory?.senate ?? null}
                sub={!!(directory?.offices.length || directory?.staff.length)}
                places={officePlaces(directory?.offices ?? [])}
              />
              {directory && <MemberOffices offices={directory.offices} />}
              {directory && <MemberStaff staff={directory.staff} offices={directory.offices} who={title} surname={String(member.last_name ?? "")} />}

              {biography && (
                <>
                  <hr />
                  <H2>Biography</H2>
                  <p>
                    The official biography on file for {title}
                    {member.bio_url ? <>, from <code>{String(member.bio_url).replace(/^https?:\/\//, "").split("/")[0]}</code></> : null}.
                  </p>
                  <p>{biography}</p>
                </>
              )}
            </div>
            {(neighbours.previous || neighbours.next) && (
              <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
                {neighbours.previous && (
                  <Button variant="secondary" size="sm" className="shadow-none" asChild>
                    <Link href={`/docs/directory/${neighbours.previous.people_id}?state=${state}`}>
                      <IconArrowLeft /> {honorific(neighbours.previous.role ?? "", neighbours.previous.chamber ?? "")} {neighbours.previous.name}
                    </Link>
                  </Button>
                )}
                {neighbours.next && (
                  <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                    <Link href={`/docs/directory/${neighbours.next.people_id}?state=${state}`}>
                      {honorific(neighbours.next.role ?? "", neighbours.next.chamber ?? "")} {neighbours.next.name} <IconArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
          <div className="h-(--top-spacing) shrink-0"></div>
          <div className="flex scroll-fade scrollbar-none flex-col gap-8 overflow-y-auto px-8">
            <MemberToc
              record={sessionName}
              finance={!!fec?.totals.length}
              committees={committees.length > 0}
              contact={!!directory?.senate}
              offices={!!directory?.offices.length}
              staff={!!directory?.staff.length}
              biography={!!biography}
            />
          </div>
          <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
            <PublicRail />
          </div>
        </div>
      </div>
    </MemberCongressProvider>
  )
}
