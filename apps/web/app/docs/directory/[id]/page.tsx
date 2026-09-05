import { type Metadata } from "next"
import { notFound } from "next/navigation"

import { stateName } from "@/lib/filters"
import { fmtCompact, honorific } from "@/lib/format"
import { getFec, getMember, getMemberDirectory, getMemberRecord, getMemberState, latestSession } from "@/lib/policy/db-queries"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { MemberFeed } from "@/components/policy/member-feed"
import { MemberHeader } from "@/components/policy/member-page"
import { MemberOffices, MemberStaff } from "@/components/policy/member-directory"
import { MemberTabs } from "@/components/policy/member-tabs"
import {
  MemberCongressProvider,
  MemberContact,
  MemberTerms,
  MemberToc,
  MemberVotes,
} from "@/components/policy/member-congress"
import { H2, H3, Table } from "@/components/typeset"

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

// One entry per member, half an hour each. The three exports have to appear
// together: `revalidate` alone on a dynamic segment does nothing.
export const revalidate = 1800
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

async function load(id: string) {
  const peopleId = Number(id)
  if (!Number.isFinite(peopleId) || peopleId <= 0) return null
  const state = await getMemberState(peopleId)
  if (!state) return null
  const session = await latestSession(state)
  // FEC totals are a federal record; a state seat files with its own board,
  // so the section exists only under Congress and says so when it is empty.
  // The directories are federal too: the House Telephone Directory for a
  // representative's offices and staff, senate.gov's contact record for a
  // senator. A state seat has neither.
  const [member, record, fec, directory] = await Promise.all([
    getMember(peopleId, session),
    getMemberRecord({ state, session }, peopleId, 20),
    state === "US" ? getFec(peopleId) : Promise.resolve(null),
    state === "US" ? getMemberDirectory(peopleId) : Promise.resolve(null),
  ])
  if (!member) return null
  // `getMember` selects the whole `"People"` row; the spread in its return
  // narrows the type back to the columns it names, so the rest are read here
  // the way the query fetched them.
  return { peopleId, state, session, member: member as typeof member & Record<string, unknown>, record, fec, directory }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await load(id)
  if (!data) return { title: "Member" }
  const { member, state } = data
  const title = `${honorific(String(member.role ?? ""), String(member.chamber ?? ""))} ${member.name}`.trim()
  return {
    title,
    description: `${title} — ${chamberName(state, String(member.chamber ?? ""))}. Sponsored bills, aye and nay votes.`,
  }
}

export default async function MemberRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await load(id)
  if (!data) notFound()
  const { peopleId, state, member, record, fec, directory } = data

  const name = String(member.name ?? "")
  const title = `${honorific(String(member.role ?? ""), String(member.chamber ?? ""))} ${name}`.trim()
  const bioguide = member.bioguide_id ? String(member.bioguide_id) : null
  const phone = member.phone_capitol ? String(member.phone_capitol) : null
  const bio = member.bio_url ? String(member.bio_url) : null
  const biography = typeof member.bio_long === "string" ? member.bio_long : ""
  const description = [
    member.leadership_title ? String(member.leadership_title) : null,
    member.district ? String(member.district).replace(/^[A-Z]+-0*/, "District ") : null,
    chamberName(state, String(member.chamber ?? "")),
  ]
    .filter(Boolean)
    .join(" · ")
  const markdown = [`# ${title}`, "", description, "", `${record.counts.prime} prime · ${record.counts.cosponsor} co-sponsored · ${record.counts.aye} aye · ${record.counts.nay} nay`].join("\n")

  return (
    <MemberCongressProvider peopleId={peopleId} bioguide={bioguide} state={state}>
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
              <H2>Record</H2>
              <H3>Bills</H3>
              <MemberTabs
                tabs={[
                  {
                    value: "prime",
                    label: "Prime Sponsor",
                    emoji: "😀",
                    count: record.counts.prime,
                    content: (
                      <MemberFeed
                        bills={record.prime}
                        total={record.counts.prime}
                        state={state}
                        peopleId={peopleId}
                        kind="prime"
                        empty={`${name} has sponsored nothing this session.`}
                      />
                    ),
                  },
                  {
                    value: "cosponsor",
                    label: "Co-Sponsor",
                    emoji: "🤝",
                    count: record.counts.cosponsor,
                    content: (
                      <MemberFeed
                        bills={record.cosponsor}
                        total={record.counts.cosponsor}
                        state={state}
                        peopleId={peopleId}
                        kind="cosponsor"
                        empty={`${name} has co-sponsored nothing this session.`}
                      />
                    ),
                  },
                ]}
              />

              <MemberVotes />

              <H3>Votes</H3>
              <MemberTabs
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
                        kind="aye"
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
                        kind="nay"
                        empty="No recorded nay votes this session."
                      />
                    ),
                  },
                ]}
              />

              {fec && (
                <>
                  <H2>Finance</H2>
                  {fec.totals.length ? (
                    <Table>
                      <thead>
                        <tr>
                          <th>Cycle</th>
                          <th>Raised</th>
                          <th>Spent</th>
                          <th>On hand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fec.totals.map((row) => (
                          <tr key={row.cycle}>
                            <td>
                              {row.cycle - 1}–{row.cycle}
                            </td>
                            <td>{fmtCompact(row.receipts)}</td>
                            <td>{fmtCompact(row.disbursements)}</td>
                            <td>{fmtCompact(row.cash_on_hand_end)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p>No FEC totals on file for {name}.</p>
                  )}
                </>
              )}

              <MemberTerms />
              <MemberContact phone={phone} bio={bio} senate={directory?.senate ?? null} />
              {directory && <MemberOffices offices={directory.offices} />}
              {directory && <MemberStaff staff={directory.staff} offices={directory.offices} />}

              {biography && (
                <>
                  <H2>Biography</H2>
                  <p>{biography}</p>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
          <div className="h-(--top-spacing) shrink-0"></div>
          <div className="flex scroll-fade scrollbar-none flex-col gap-8 overflow-y-auto px-8">
            <MemberToc
              finance={!!fec}
              contact={!!(phone || bio || directory?.senate)}
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
