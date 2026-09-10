import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { chamberName, getRollCallVote, parseSessionSlug, sessionName } from "@/lib/policy/roll-call-queries"
import { Chip } from "@/components/chip"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { TableBlock } from "@/components/policy/table-block"
import { H2, Table } from "@/components/typeset"

// One roll call, member by member — congress.gov's vote page. The tally by
// party first, because that is the shape of a vote, then every member with the
// way they answered, alphabetical as the clerk reads the roll.

export const revalidate = 3600
export const dynamicParams = true

type Props = { params: Promise<{ session: string; roll: string }> }

export async function generateStaticParams() {
  return []
}

async function load(session: string, roll: string) {
  const scope = parseSessionSlug(session)
  const number = Number(roll)
  if (!scope || !Number.isInteger(number) || number <= 0) return null
  const found = await getRollCallVote(scope.chamber, scope.congress, scope.session, number).catch(() => null)
  return found ? { ...found, scope } : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { session, roll } = await params
  const held = await load(session, roll)
  if (!held) return { title: "Roll call vote" }
  const { vote } = held
  return {
    title: `${chamberName(vote.chamber)} roll call ${vote.roll}${vote.citation ? ` — ${vote.citation}` : ""}`,
    description: vote.question ?? vote.description ?? undefined,
  }
}

export default async function RollCallVotePage({ params }: Props) {
  const { session, roll } = await params
  const held = await load(session, roll)
  if (!held) notFound()
  const { vote, positions, casts, byParty, scope } = held
  const congress = congressName(1789 + (vote.congress - 1) * 2)
  const slug = session.toLowerCase()
  const total = positions.length
  const chamber = chamberName(vote.chamber)

  return (
    <DocsPage
      title={`${chamber} roll call ${vote.roll}`}
      description={vote.question ?? vote.description ?? `${chamber} vote ${vote.roll}, ${sessionName(vote.session)} of the ${congress}.`}
      slug={`/roll-call-votes/${slug}/${vote.roll}`}
      previous={vote.roll > 1 ? { name: `Roll ${vote.roll - 1}`, url: `/roll-call-votes/${slug}/${vote.roll - 1}` } : { name: chamber, url: `/roll-call-votes/${slug}` }}
      next={{ name: `Roll ${vote.roll + 1}`, url: `/roll-call-votes/${slug}/${vote.roll + 1}` }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Result", url: "#result", depth: 2 },
            { title: "By party", url: "#by-party", depth: 2 },
            { title: "Members", url: "#members", depth: 2 },
          ]}
        />
      }
    >
      <H2 id="result">Result</H2>
      <p>
        The {chamber} answered <strong>{vote.question ?? "the question"}</strong>
        {vote.citation ? (
          <>
            {" "}
            on{" "}
            {vote.bill_id ? (
              <Link href={`/bills/${vote.bill_id}`}>
                <Chip>{vote.citation}</Chip>
              </Link>
            ) : (
              <Chip>{vote.citation}</Chip>
            )}
          </>
        ) : (
          ""
        )}
        {vote.date ? ` on ${fmtDate(vote.date.slice(0, 10))}` : ""}: <strong>{vote.result ?? "—"}</strong>,{" "}
        {vote.yea ?? 0} to {vote.nay ?? 0}
        {vote.present ? `, ${vote.present} present` : ""}
        {vote.not_voting ? `, ${vote.not_voting} ${vote.chamber === "senate" ? "absent" : "not voting"}` : ""}. Roll{" "}
        <code>{vote.roll}</code> of the {sessionName(vote.session)}, {congress}.
      </p>
      {vote.description && vote.description !== vote.question && <p>{vote.description}</p>}

      <H2 id="by-party">By party</H2>
      <p>
        <code>{fmtNumber(total)}</code> {total === 1 ? "member" : "members"} answered the roll, in{" "}
        {byParty.length} {byParty.length === 1 ? "party" : "parties"}.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[30%]">Party</th>
            {casts.map((cast) => (
              <th key={cast} className="text-right">
                {cast}
              </th>
            ))}
            <th className="pr-8 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {byParty.map((p) => (
            <tr key={p.party}>
              <td>{p.party}</td>
              {casts.map((cast) => (
                <td key={cast} className="text-right tabular-nums">
                  {p.counts[cast] ?? 0}
                </td>
              ))}
              <td className="pr-8 text-right tabular-nums">{Object.values(p.counts).reduce((sum, v) => sum + v, 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="font-medium">All</td>
            {casts.map((cast) => (
              <td key={cast} className="text-right font-medium tabular-nums">
                {byParty.reduce((sum, p) => sum + (p.counts[cast] ?? 0), 0)}
              </td>
            ))}
            <td className="pr-8 text-right font-medium tabular-nums">{fmtNumber(total)}</td>
          </tr>
        </tfoot>
      </Table>

      <H2 id="members">Members</H2>
      <p>Every member of the {chamber} who answered, as the clerk read the roll.</p>
      <TableBlock rows={positions.length}>
      <Table>
        <thead>
          <tr>
            <th className="w-[46%]">Member</th>
            <th className="w-[14%]">Party</th>
            <th className="w-[14%]">State</th>
            <th className="w-[26%] pr-8 text-right">Vote</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={`${p.bioguide_id ?? p.name}-${p.state}`}>
              <td>{p.people_id ? <Link href={memberHref(p.people_id, "US")}>{p.name}</Link> : p.name}</td>
              <td>{p.party ?? "—"}</td>
              <td>{p.state ?? "—"}</td>
              <td className="pr-8 text-right">{p.vote_cast ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>
      <hr />
      <p>
        Source:{" "}
        {scope.chamber === "house" ? (
          <a href={`https://clerk.house.gov/Votes/${String(vote.date ?? "").slice(0, 4)}${String(vote.roll).padStart(3, "0")}`} target="_blank" rel="noopener noreferrer">
            clerk.house.gov
          </a>
        ) : (
          <a
            href={`https://www.senate.gov/legislative/LIS/roll_call_votes/vote${vote.congress}${vote.session}/vote_${vote.congress}_${vote.session}_${String(vote.roll).padStart(5, "0")}.htm`}
            target="_blank"
            rel="noopener noreferrer"
          >
            senate.gov
          </a>
        )}
        .
      </p>
    </DocsPage>
  )
}
