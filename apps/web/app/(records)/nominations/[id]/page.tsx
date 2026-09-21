import { type Metadata } from "next"
import { notFound } from "next/navigation"

import { fmtDate, fmtNumber } from "@/lib/format"
import { getNomination, getNominationActions, getNominationCommittees, getNominationHearings, getNominationNeighbours } from "@/lib/policy/committee-queries"
import { congressNominationHref } from "@/lib/policy/congress-hrefs"
import { DocsPage } from "@/components/docs-page"
import { RecordFacts } from "@/components/record-header"
import { NominationActions, NominationCommittees, NominationHearings, NominationToc } from "@/components/policy/nomination-page"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One nomination, by citation ("PN1255-8"). On DocsPage since 2026-09-20
// (Brendan): the shell draws the head, the arrows, Copy Page and the rail it
// had a copy of, and the facts are its sub-header.

export const revalidate = 3600

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
  const parts: string[] = []
  if (actions.length) parts.push("Actions")
  if (committees.length) parts.push("Committees")
  if (hearings.length) parts.push("Hearings")
  const referredTo = committees[0] ?? actions.flatMap((a) => a.committees)[0] ?? null

  const href = (n: { citation: string | null; key: string }) => `/nominations/${encodeURIComponent((n.citation ?? n.key).toLowerCase())}`

  return (
    <DocsPage
      title={name}
      description={nomination.description ?? "A nomination before the Senate."}
      page={markdown}
      lead={<RecordFacts meta={facts} />}
      slug={href(nomination)}
      previous={neighbours.previous ? { name: neighbours.previous.citation ?? neighbours.previous.key, url: href(neighbours.previous) } : { name: "Nominations", url: "/nominations" }}
      next={neighbours.next ? { name: neighbours.next.citation ?? neighbours.next.key, url: href(neighbours.next) } : undefined}
      rail={<NominationToc parts={parts} />}
    >
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
    </DocsPage>
  )
}
