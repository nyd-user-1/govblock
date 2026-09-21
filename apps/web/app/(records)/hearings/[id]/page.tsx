import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { fmtDate, fmtNumber } from "@/lib/format"
import { getHearing, getHearingMeeting, getHearingNeighbours } from "@/lib/policy/committee-queries"
import { DocsPage } from "@/components/docs-page"
import { RecordFacts } from "@/components/record-header"
import { HearingDocuments, HearingToc, HearingTranscript, HearingWitnesses } from "@/components/policy/hearing-page"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One hearing, by jacket number, on DocsPage (Brendan, 2026-09-20): the citation
// as the name, the committee and the date as the facts, the title as the
// Summary sentence, and the transcript first in the Record. The transcript
// lands with livingston's hearing-texts.mjs; the witnesses and the bills come
// from the meeting record of the same committee on the same day.

export const revalidate = 3600

const CONGRESS = 119
const STATE = "US"

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error("hearing: family unavailable", error instanceof Error ? error.message : error)
    return fallback
  }
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const hearing = await safe(() => getHearing(id), null)
  if (!hearing) return { title: "Hearing" }
  return { title: hearing.citation ?? `Hearing ${hearing.jacket}`, description: hearing.title ?? `A hearing of the ${CONGRESS}th Congress.` }
}

export default async function HearingRoute({ params }: Props) {
  const { id } = await params
  const hearing = await safe(() => getHearing(id), null)
  if (!hearing) notFound()
  const [meeting, neighbours] = await Promise.all([safe(() => getHearingMeeting(hearing.committee_code, hearing.date), null), safe(() => getHearingNeighbours(hearing.key), { previous: null, next: null })])
  const name = hearing.citation ?? `Hearing ${hearing.jacket}`
  const committee = hearing.committees[0] ?? (hearing.committee_code ? { code: hearing.committee_code, name: hearing.committee_name ?? hearing.committee_code } : null)
  const facts = [
    hearing.chamber ? `U.S. ${hearing.chamber}` : null,
    committee ? (
      <Link key="c" href={`/committees/${committee.code}`} className="hover:underline">
        {committee.name}
      </Link>
    ) : null,
    hearing.date ? fmtDate(hearing.date) : null,
  ]
  const markdown = [`# ${name}`, "", hearing.title ?? "", "", hearing.text ? hearing.text.slice(0, 4000) : ""].join("\n")
  const parts = ["Transcript"]
  if (meeting?.witnesses.length) parts.push("Witnesses")
  if (meeting?.documents.length || meeting?.bills.length) parts.push("Documents")

  return (
    <DocsPage
      title={name}
      description={hearing.title ?? `A hearing of the ${CONGRESS}th Congress.`}
      page={markdown}
      lead={<RecordFacts meta={facts} />}
      slug={`/hearings/${hearing.jacket}`}
      previous={neighbours.previous ? { name: neighbours.previous.citation ?? neighbours.previous.key, url: `/hearings/${neighbours.previous.key}` } : { name: "Hearings", url: "/hearings" }}
      next={neighbours.next ? { name: neighbours.next.citation ?? neighbours.next.key, url: `/hearings/${neighbours.next.key}` } : undefined}
      rail={<HearingToc parts={parts} />}
    >
      <H2>Summary</H2>
      <p>
        {hearing.title ? (
          <>
            <Chip>{name}</Chip> is a hearing titled <em>{hearing.title}</em>
          </>
        ) : (
          <>
            <Chip>{name}</Chip> is a hearing of the {CONGRESS}th Congress
          </>
        )}
        {committee ? (
          <>
            , held by the <Chip>{committee.name}</Chip>
          </>
        ) : null}
        {hearing.date ? <> on {fmtDate(hearing.date)}</> : null}
        {hearing.dates.length > 1 ? (
          <>
            {" "}
            and {hearing.dates.length - 1} other {hearing.dates.length === 2 ? "day" : "days"}
          </>
        ) : null}
        .{meeting?.type ? ` It was a ${meeting.type.toLowerCase()}` : ""}
        {meeting?.building ? `${meeting.type ? "" : " It sat"} in ${meeting.building}${meeting.room ? `, Room ${meeting.room}` : ""}` : ""}
        {meeting?.type || meeting?.building ? "." : ""}
      </p>

      <hr />
      <H2>Record</H2>
      <p>
        <Chip>{name}</Chip> has {hearing.text ? "its transcript" : "no transcript yet"}
        {meeting?.witnesses.length ? (
          <>
            , {fmtNumber(meeting.witnesses.length)} {meeting.witnesses.length === 1 ? "witness" : "witnesses"}
          </>
        ) : null}
        {meeting?.documents.length ? (
          <>
            {" "}
            and {fmtNumber(meeting.documents.length)} {meeting.documents.length === 1 ? "document" : "documents"}
          </>
        ) : null}{" "}
        on the record.
      </p>
      {meeting && (
        <p>
          The meeting's own record, with its video, documents and witnesses, is at <Link href={`/meetings/${meeting.event_id}`}>{meeting.title ?? `${meeting.type ?? "Meeting"} ${meeting.event_id}`}</Link>.
        </p>
      )}
      <HearingTranscript hearing={hearing} state={STATE} />
      <HearingWitnesses meeting={meeting} />
      <HearingDocuments meeting={meeting} />
    </DocsPage>
  )
}
