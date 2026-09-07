import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { fmtDate, fmtNumber } from "@/lib/format"
import { getHearing, getHearingMeeting, getHearingNeighbours } from "@/lib/policy/committee-queries"
import { BackToTop } from "@/components/back-to-top"
import { Button } from "@govblock/ui/components/ny4/button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { ChamberSeal } from "@/components/policy/imagery"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { HearingDocuments, HearingToc, HearingTranscript, HearingWitnesses } from "@/components/policy/hearing-page"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One hearing, by jacket number, on the member page's design: the citation
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
      <Link key="c" href={`/docs/committees/${committee.code}`} className="hover:underline">
        {committee.name}
      </Link>
    ) : null,
    hearing.date ? fmtDate(hearing.date) : null,
  ]
  const markdown = [`# ${name}`, "", hearing.title ?? "", "", hearing.text ? hearing.text.slice(0, 4000) : ""].join("\n")
  const arrow = "extend-touch-target size-8 shadow-none md:size-7"
  const parts = ["Transcript"]
  if (meeting?.witnesses.length) parts.push("Witnesses")
  if (meeting?.documents.length || meeting?.bills.length) parts.push("Documents")

  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <RecordHeader
            media={<ChamberSeal state={STATE} chamber={hearing.chamber} size={RECORD_MEDIA} />}
            title={name}
            meta={facts}
            action={
              <>
                <DocsCopyPage page={markdown} url={`https://govblock.app/docs/hearings/${hearing.jacket}`} />
                {neighbours.previous ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/docs/hearings/${neighbours.previous.key}`} title={neighbours.previous.citation ?? undefined}>
                      <IconArrowLeft />
                      <span className="sr-only">Previous hearing</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href="/docs/hearings">
                      <IconArrowLeft />
                      <span className="sr-only">All hearings</span>
                    </Link>
                  </Button>
                )}
                {neighbours.next ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/docs/hearings/${neighbours.next.key}`} title={neighbours.next.citation ?? undefined}>
                      <IconArrowRight />
                      <span className="sr-only">Next hearing</span>
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
                The meeting's own record, with its video, documents and witnesses, is at <Link href={`/docs/meetings/${meeting.event_id}`}>{meeting.title ?? `${meeting.type ?? "Meeting"} ${meeting.event_id}`}</Link>.
              </p>
            )}
            <HearingTranscript hearing={hearing} state={STATE} />
            <HearingWitnesses meeting={meeting} />
            <HearingDocuments meeting={meeting} />

            {(hearing.text_url || hearing.pdf_url) && (
              <>
                <hr />
                <p>
                  Source:{" "}
                  <a href={hearing.text_url ?? hearing.pdf_url ?? "#"} target="_blank" rel="noopener noreferrer">
                    congress.gov
                  </a>
                  {hearing.loc_id ? <> · {hearing.loc_id}</> : null}
                </p>
              </>
            )}
          </div>
          {(neighbours.previous || neighbours.next) && (
            <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
              {neighbours.previous && (
                <Button variant="secondary" size="sm" className="shadow-none" asChild>
                  <Link href={`/docs/hearings/${neighbours.previous.key}`}>
                    <IconArrowLeft /> {neighbours.previous.citation ?? neighbours.previous.key}
                  </Link>
                </Button>
              )}
              {neighbours.next && (
                <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                  <Link href={`/docs/hearings/${neighbours.next.key}`}>
                    {neighbours.next.citation ?? neighbours.next.key} <IconArrowRight />
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
          <HearingToc parts={parts} />
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
