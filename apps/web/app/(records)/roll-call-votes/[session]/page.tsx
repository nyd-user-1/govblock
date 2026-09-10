import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { chamberName, getRollCalls, getRollCallSessions, parseSessionSlug, sessionName, sessionSlug } from "@/lib/policy/roll-call-queries"
import { Chip } from "@/components/chip"
import { DocsPage } from "@/components/docs-page"
import { TableBlock } from "@/components/policy/table-block"
import { Table } from "@/components/typeset"

// One session's roll calls, newest first — congress.gov/votes/house/119th-congress/1st-session.
// A page at a time: a session runs to several hundred votes and every row
// carries a tally, so the whole session in one response would be a slow page
// and, on Amplify, a cut one.

export const revalidate = 3600
export const dynamicParams = true

const PAGE = 100

type Props = { params: Promise<{ session: string }>; searchParams: Promise<{ page?: string }> }

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const scope = parseSessionSlug((await params).session)
  if (!scope) return { title: "Roll call votes" }
  const congress = congressName(1789 + (scope.congress - 1) * 2)
  return {
    title: `${chamberName(scope.chamber)} roll calls, ${congress}`,
    description: `Every recorded ${chamberName(scope.chamber)} vote of the ${scope.session === 1 ? "first" : "second"} session of the ${congress}.`,
  }
}

export default async function RollCallSessionPage({ params, searchParams }: Props) {
  const scope = parseSessionSlug((await params).session)
  if (!scope) notFound()
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1)
  const [{ rows, total }, sessions] = await Promise.all([
    getRollCalls(scope.chamber, scope.congress, scope.session, PAGE, (page - 1) * PAGE).catch(() => ({ rows: [], total: 0 })),
    getRollCallSessions().catch(() => []),
  ])
  if (!total) notFound()

  const congress = congressName(1789 + (scope.congress - 1) * 2)
  const slug = sessionSlug(scope.chamber, scope.congress, scope.session)
  const at = sessions.findIndex((s) => sessionSlug(s.chamber, s.congress, s.session) === slug)
  const previous = sessions[at - 1]
  const next = sessions[at + 1]
  const pages = Math.ceil(total / PAGE)
  const onBills = rows.filter((r) => r.citation).length

  return (
    <DocsPage
      title={`${chamberName(scope.chamber)}, ${sessionName(scope.session)}`}
      description={`${fmtNumber(total)} recorded ${total === 1 ? "vote" : "votes"} of the ${congress}, newest first.`}
      slug={`/roll-call-votes/${slug}`}
      previous={previous ? { name: `${chamberName(previous.chamber)} ${sessionName(previous.session)}`, url: `/roll-call-votes/${sessionSlug(previous.chamber, previous.congress, previous.session)}` } : { name: "Roll call votes", url: "/roll-call-votes" }}
      next={next ? { name: `${chamberName(next.chamber)} ${sessionName(next.session)}`, url: `/roll-call-votes/${sessionSlug(next.chamber, next.congress, next.session)}` } : { name: "Roll call votes", url: "/roll-call-votes" }}
    >
      <p>
        Roll call <code>{rows[rows.length - 1]?.roll ?? 0}</code> to <code>{rows[0]?.roll ?? 0}</code> of{" "}
        <code>{fmtNumber(total)}</code>, {onBills} of them on a bill or resolution and the rest on nominations, motions and
        procedure. A roll number opens the vote and every member&rsquo;s position on it.
      </p>
      <TableBlock rows={rows.length}>
      <Table>
        <thead>
          <tr>
            <th className="w-[8%]">Roll</th>
            <th className="w-[12%]">Date</th>
            <th className="w-[14%]">Measure</th>
            <th className="w-[38%]">Question</th>
            <th className="w-[14%]">Result</th>
            <th className="w-[14%] pr-8 text-right">Tally</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.roll}>
              <td className="tabular-nums">
                <Link href={`/roll-call-votes/${slug}/${r.roll}`}>{r.roll}</Link>
              </td>
              <td className="whitespace-nowrap">{r.date ? fmtDate(r.date.slice(0, 10)) : "—"}</td>
              <td className="whitespace-nowrap">
                {r.citation ? r.bill_id ? <Link href={`/bills/${r.bill_id}`}>{r.citation}</Link> : r.citation : "—"}
              </td>
              <td>{truncate(r.question ?? r.description ?? "", 120) || "—"}</td>
              <td>{r.result ?? "—"}</td>
              <td className="pr-8 text-right whitespace-nowrap tabular-nums">
                {r.yea == null || r.nay == null ? "—" : `${r.yea}–${r.nay}`}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      </TableBlock>
      {pages > 1 && (
        <p>
          Page {page} of {pages}.{" "}
          {page > 1 && (
            <>
              <Link href={`/roll-call-votes/${slug}?page=${page - 1}`}>Newer</Link>
              {page < pages ? " · " : ""}
            </>
          )}
          {page < pages && <Link href={`/roll-call-votes/${slug}?page=${page + 1}`}>Older</Link>}
        </p>
      )}
      <hr />
      <p>
        Source:{" "}
        {scope.chamber === "house" ? (
          <a href={`https://www.congress.gov/roll-call-votes`} target="_blank" rel="noopener noreferrer">
            congress.gov
          </a>
        ) : (
          <a href={`https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${scope.congress}_${scope.session}.htm`} target="_blank" rel="noopener noreferrer">
            senate.gov
          </a>
        )}
        . <Chip>{`${chamberName(scope.chamber)} ${scope.congress}-${scope.session}`}</Chip>
      </p>
    </DocsPage>
  )
}
