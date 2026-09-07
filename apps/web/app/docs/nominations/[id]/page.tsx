import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { fmtDate, fmtNumber } from "@/lib/format"
import { getNomination, getNominationActions, getNominationCommittees, getNominationHearings, getNominationNeighbours } from "@/lib/policy/committee-queries"
import { BackToTop } from "@/components/back-to-top"
import { Button } from "@govblock/ui/components/ny4/button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { ChamberSeal } from "@/components/policy/imagery"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { congressNominationHref } from "@/lib/policy/congress-hrefs"
import { NominationActions, NominationCommittees, NominationHearings, NominationToc } from "@/components/policy/nomination-page"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One nomination, by citation ("PN1255-8"), on the member page's design.

export const revalidate = 3600

const STATE = "US"

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error("nomination: family unavailable", error instanceof Error ? error.message : error)
    return fallback
  }
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const nomination = await safe(() => getNomination(decodeURIComponent(id)), null)
  if (!nomination) return { title: "Nomination" }
  return { title: nomination.citation ?? nomination.key, description: nomination.description ?? "A nomination before the Senate." }
}

export default async function NominationRoute({ params }: Props) {
  const { id } = await params
  const nomination = await safe(() => getNomination(decodeURIComponent(id)), null)
  if (!nomination) notFound()
  const [actions, committees, hearings, neighbours] = await Promise.all([
    safe(() => getNominationActions(nomination.key), []),
    safe(() => getNominationCommittees(nomination.key), []),
    safe(() => getNominationHearings(nomination.key), []),
    safe(() => getNominationNeighbours(nomination.key), { previous: null, next: null }),
  ])
  const name = nomination.citation ?? nomination.key
  const positions = nomination.nominees.map((x) => x.position).filter(Boolean) as string[]
  const facts = [nomination.organization, nomination.received ? `Received ${fmtDate(nomination.received)}` : null, nomination.is_privileged ? "Privileged" : null]
  const markdown = [`# ${name}`, "", nomination.description ?? "", "", nomination.latest_action ?? ""].join("\n")
  const arrow = "extend-touch-target size-8 shadow-none md:size-7"
  const parts: string[] = []
  if (actions.length) parts.push("Actions")
  if (committees.length) parts.push("Committees")
  if (hearings.length) parts.push("Hearings")
  const referredTo = committees[0] ?? actions.flatMap((a) => a.committees)[0] ?? null

  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <RecordHeader
            media={<ChamberSeal state={STATE} chamber="Senate" size={RECORD_MEDIA} />}
            title={name}
            meta={facts}
            action={
              <>
                <DocsCopyPage page={markdown} url={`https://govblock.app/docs/nominations/${encodeURIComponent(name.toLowerCase())}`} />
                {neighbours.previous ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/docs/nominations/${encodeURIComponent((neighbours.previous.citation ?? neighbours.previous.key).toLowerCase())}`} title={neighbours.previous.citation ?? undefined}>
                      <IconArrowLeft />
                      <span className="sr-only">Previous nomination</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href="/docs/nominations">
                      <IconArrowLeft />
                      <span className="sr-only">All nominations</span>
                    </Link>
                  </Button>
                )}
                {neighbours.next ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={`/docs/nominations/${encodeURIComponent((neighbours.next.citation ?? neighbours.next.key).toLowerCase())}`} title={neighbours.next.citation ?? undefined}>
                      <IconArrowRight />
                      <span className="sr-only">Next nomination</span>
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
              <Chip>{name}</Chip> nominates {nomination.description ? nomination.description.replace(/\.$/, "") : positions.length ? `a nominee to be ${positions.join("; ")}` : "a nominee"}
              {nomination.received ? <>, received in the Senate on {fmtDate(nomination.received)}</> : null}
              {referredTo ? (
                <>
                  {" "}
                  and referred to the <Chip>{referredTo.name}</Chip>
                </>
              ) : null}
              .
            </p>
            {nomination.latest_action && (
              <p>
                {nomination.latest_action_date ? (
                  <>
                    On {fmtDate(nomination.latest_action_date)}: {nomination.latest_action}
                  </>
                ) : (
                  nomination.latest_action
                )}
              </p>
            )}

            <hr />
            <H2>Record</H2>
            <p>
              <Chip>{name}</Chip> has {fmtNumber(actions.length)} {actions.length === 1 ? "action" : "actions"}
              {committees.length ? (
                <>
                  , {committees.length} {committees.length === 1 ? "committee" : "committees"}
                </>
              ) : null}
              {hearings.length ? (
                <>
                  {" "}
                  and {hearings.length} {hearings.length === 1 ? "hearing" : "hearings"}
                </>
              ) : null}{" "}
              on the record.
            </p>
            <NominationActions actions={actions} who={name} />
            <NominationCommittees committees={committees} who={name} />
            <NominationHearings hearings={hearings} who={name} />

            <hr />
            <p>
              Source:{" "}
              <a href={congressNominationHref(nomination)} target="_blank" rel="noopener noreferrer">
                congress.gov
              </a>
            </p>
          </div>
          {(neighbours.previous || neighbours.next) && (
            <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
              {neighbours.previous && (
                <Button variant="secondary" size="sm" className="shadow-none" asChild>
                  <Link href={`/docs/nominations/${encodeURIComponent((neighbours.previous.citation ?? neighbours.previous.key).toLowerCase())}`}>
                    <IconArrowLeft /> {neighbours.previous.citation ?? neighbours.previous.key}
                  </Link>
                </Button>
              )}
              {neighbours.next && (
                <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                  <Link href={`/docs/nominations/${encodeURIComponent((neighbours.next.citation ?? neighbours.next.key).toLowerCase())}`}>
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
          <NominationToc parts={parts} />
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
