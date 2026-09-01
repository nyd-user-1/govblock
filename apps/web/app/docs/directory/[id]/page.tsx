import { type Metadata } from "next"
import { notFound } from "next/navigation"

import { stateName } from "@/lib/filters"
import { honorific } from "@/lib/format"
import { getMember, getMemberRecord, getMemberState, latestSession } from "@/lib/policy/db-queries"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { OpenInV0Cta } from "@/components/open-in-v0-cta"
import { MemberFeed, MemberHeader } from "@/components/policy/member-page"
import { MemberTabs } from "@/components/policy/member-tabs"
import {
  MemberCongressProvider,
  MemberContact,
  MemberFederalNote,
  MemberTerms,
  MemberToc,
  MemberVotes,
} from "@/components/policy/member-congress"
import { H2 } from "@/components/typeset"

// A member's own page, keyed by `people_id` — globally unique, so the route
// learns the jurisdiction from the person rather than the other way round.
// Ported from livingston-v3 app/(app)/docs/members/[id]/page.tsx into the docs
// shell the bill page uses; `memberHref` has pointed here since the directory
// landed, and until today it went nowhere.
//
// Rendered on the server. The path names exactly one person, so a shared link,
// a crawler and a reader with slow JS all see who it is. The portrait, the
// terms and the floor votes arrive from congress.gov after that.

const SECTIONS = ["Record"]

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
  const [member, record] = await Promise.all([
    getMember(peopleId, session),
    getMemberRecord({ state, session }, peopleId, 25),
  ])
  if (!member) return null
  // `getMember` selects the whole `"People"` row; the spread in its return
  // narrows the type back to the columns it names, so the rest are read here
  // the way the query fetched them.
  return { peopleId, state, session, member: member as typeof member & Record<string, unknown>, record }
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
  const { peopleId, state, session, member, record } = data

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
  const markdown = [`# ${title}`, "", description, "", `${record.counts.sponsored} sponsored · ${record.counts.aye} aye · ${record.counts.nay} nay`].join("\n")

  return (
    <MemberCongressProvider peopleId={peopleId} bioguide={bioguide}>
      <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-(--top-spacing) shrink-0" />
          <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
            <div className="flex items-center justify-end">
              <div className="docs-nav hidden sm:block">
                <DocsCopyPage page={markdown} url={`https://govblock.app/docs/directory/${peopleId}`} />
              </div>
            </div>
            <MemberHeader peopleId={peopleId} state={state} session={session} member={member} counts={record.counts} />
            <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
              <H2>Record</H2>
              <MemberTabs
                counts={record.counts}
                sponsored={
                  <MemberFeed
                    bills={record.sponsored}
                    total={record.counts.sponsored}
                    empty={`${name} has sponsored nothing this session.`}
                  />
                }
                aye={
                  <MemberFeed
                    bills={record.aye}
                    total={record.counts.aye}
                    vote="Aye"
                    empty="No recorded aye votes this session."
                  />
                }
                nay={
                  <MemberFeed
                    bills={record.nay}
                    total={record.counts.nay}
                    vote="Nay"
                    empty="No recorded nay votes this session."
                  />
                }
              />

              <MemberTerms />
              <MemberVotes />
              <MemberContact phone={phone} bio={bio} />

              {biography && (
                <>
                  <H2>Biography</H2>
                  <p>{biography}</p>
                </>
              )}
              <MemberFederalNote />
            </div>
          </div>
        </div>
        <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
          <div className="h-(--top-spacing) shrink-0"></div>
          <div className="flex scroll-fade scrollbar-none flex-col gap-8 overflow-y-auto px-8">
            <MemberToc base={SECTIONS} contact={!!(phone || bio)} biography={!!biography} />
          </div>
          <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
            <OpenInV0Cta />
          </div>
        </div>
      </div>
    </MemberCongressProvider>
  )
}
