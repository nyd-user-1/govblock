import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { fmtDate, fmtNumber, fmtTime } from "@/lib/format"
import { getBillsByCongressNumber, getHearing, getMeeting, getMeetingNeighbours, type HearingRecord } from "@/lib/policy/committee-queries"
import { BackToTop } from "@/components/back-to-top"
import { Button } from "@govblock/ui/components/ny4/button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { ChamberSeal } from "@/components/policy/imagery"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { HearingTranscript } from "@/components/policy/hearing-page"
import { MeetingBills, MeetingDocuments, MeetingToc, MeetingVideo, MeetingWitnesses } from "@/components/policy/meeting-page"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One committee meeting, by congress.gov's event id, on the member page's
// design: the title as the name, the kind, the committee and the day as the
// facts; then the video, the transcript once GPO has printed it, the
// witnesses with their papers, the documents, and the bills.

export const revalidate = 3600

const STATE = "US"

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error("meeting: family unavailable", error instanceof Error ? error.message : error)
    return fallback
  }
}

/** The meeting's day and clock time in the Capitol's zone. */
function when(iso: string | null) {
  if (!iso) return { date: null as string | null, time: null as string | null }
  if (!iso.includes("T")) return { date: iso.slice(0, 10), time: null }
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return { date: iso.slice(0, 10), time: null }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}` }
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const meeting = await safe(() => getMeeting(id), null)
  if (!meeting) return { title: "Meeting" }
  return { title: meeting.title ?? `${meeting.type ?? "Meeting"} ${meeting.event_id}`, description: [meeting.committee_name, meeting.date ? fmtDate(meeting.date) : null].filter(Boolean).join(" · ") }
}

export default async function MeetingRoute({ params }: Props) {
  const { id } = await params
  const meeting = await safe(() => getMeeting(id), null)
  if (!meeting) notFound()
  const [neighbours, held, hearing] = await Promise.all([
    safe(() => getMeetingNeighbours(meeting), { previous: null, next: null }),
    safe(() => getBillsByCongressNumber(meeting.bills), new Map<string, { bill_id: number; title: string }>()),
    meeting.transcript_jacket ? safe(() => getHearing(meeting.transcript_jacket!), null) : Promise.resolve<HearingRecord | null>(null),
  ])
  const at = when(meeting.date)
  const kind = meeting.type ?? "Meeting"
  const name = meeting.title ?? `${kind} ${meeting.event_id}`
  const committee = meeting.committees[0] ?? (meeting.committee_code ? { code: meeting.committee_code, name: meeting.committee_name ?? meeting.committee_code } : null)
  const facts = [
    kind,
    committee ? (
      <Link key="c" href={`/docs/committees/${committee.code.toLowerCase()}`} className="hover:underline">
        {committee.name}
      </Link>
    ) : null,
    at.date ? `${fmtDate(at.date)}${at.time ? ` · ${fmtTime(at.time)}` : ""}` : null,
  ]
  const room = [meeting.building, meeting.room ? `Room ${meeting.room}` : null].filter(Boolean).join(", ")
  const markdown = [`# ${name}`, "", [kind, committee?.name, at.date ? fmtDate(at.date) : null].filter(Boolean).join(" · ")].join("\n")
  const arrow = "extend-touch-target size-8 shadow-none md:size-7"
  const parts: string[] = []
  if (meeting.videos.some((v) => /youtu/.test(v.url))) parts.push("Video")
  if (hearing) parts.push("Transcript")
  if (meeting.witnesses.length) parts.push("Witnesses")
  if (meeting.documents.some((d) => d.url)) parts.push("Documents")
  if (meeting.bills.length) parts.push("Bills")
  const past = at.date ? at.date < new Date().toISOString().slice(0, 10) : false
  const heldBills = Object.fromEntries(held)

  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <RecordHeader
            media={<ChamberSeal state={STATE} chamber={meeting.chamber} size={RECORD_MEDIA} />}
            title={name}
            meta={facts}
            action={
              <>
                <DocsCopyPage page={markdown} url={`https://govblock.app/docs/meetings/${meeting.event_id}`} />
                {neighbours.previous ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/docs/meetings/${neighbours.previous.event_id}`} title={neighbours.previous.title ?? undefined}>
                      <IconArrowLeft />
                      <span className="sr-only">Previous meeting</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={committee ? `/docs/committees/${committee.code.toLowerCase()}` : "/docs/committees?state=US"}>
                      <IconArrowLeft />
                      <span className="sr-only">The committee</span>
                    </Link>
                  </Button>
                )}
                {neighbours.next ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/docs/meetings/${neighbours.next.event_id}`} title={neighbours.next.title ?? undefined}>
                      <IconArrowRight />
                      <span className="sr-only">Next meeting</span>
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
              {committee ? <Chip>{committee.name}</Chip> : "The committee"} {past ? "held" : "holds"} {/^[aeiou]/i.test(kind) ? "an" : "a"} {kind.toLowerCase()}
              {at.date ? (
                <>
                  {" "}
                  on {fmtDate(at.date)}
                  {at.time ? <> at {fmtTime(at.time)}</> : null}
                </>
              ) : null}
              {room ? ` in ${room}` : ""}
              {meeting.status && meeting.status !== "Scheduled" ? `, ${meeting.status.toLowerCase()}` : ""}.
              {meeting.witnesses.length ? (
                <>
                  {" "}
                  {fmtNumber(meeting.witnesses.length)} {meeting.witnesses.length === 1 ? "witness" : "witnesses"} {past ? "appeared" : "are called"}.
                </>
              ) : null}
            </p>
            {!meeting.detailed && <p>The record holds the listing alone so far; the witnesses, documents and video land with the harvest.</p>}

            <hr />
            <H2>Record</H2>
            <p>
              The meeting has{" "}
              {parts.length
                ? parts.map((p, i) => (
                    <span key={p}>
                      {i > 0 ? (i === parts.length - 1 ? " and " : ", ") : ""}
                      {p.toLowerCase() === "video" ? "its video" : p.toLowerCase() === "transcript" ? "its transcript" : `${p.toLowerCase()}`}
                    </span>
                  ))
                : "nothing but its listing"}{" "}
              on the record.
            </p>
            <MeetingVideo meeting={meeting} />
            {hearing && <HearingTranscript hearing={hearing} state={STATE} />}
            <MeetingWitnesses meeting={meeting} />
            <MeetingDocuments meeting={meeting} />
            <MeetingBills meeting={meeting} held={heldBills} />
          </div>
          {(neighbours.previous || neighbours.next) && (
            <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
              {neighbours.previous && (
                <Button variant="secondary" size="sm" className="shadow-none" asChild>
                  <Link href={`/docs/meetings/${neighbours.previous.event_id}`}>
                    <IconArrowLeft /> {neighbours.previous.meeting_date ? fmtDate(neighbours.previous.meeting_date) : "Previous"}
                  </Link>
                </Button>
              )}
              {neighbours.next && (
                <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                  <Link href={`/docs/meetings/${neighbours.next.event_id}`}>
                    {neighbours.next.meeting_date ? fmtDate(neighbours.next.meeting_date) : "Next"} <IconArrowRight />
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
          <MeetingToc parts={parts} />
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
