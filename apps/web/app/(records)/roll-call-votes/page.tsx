import Link from "next/link"

import { fmtDate, fmtNumber } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { chamberName, getRollCallSessions, sessionName, sessionSlug } from "@/lib/policy/roll-call-queries"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, Table } from "@/components/typeset"

// Roll-call votes, on the Bulk Datasets page's shape: a section per congress,
// and under it each chamber's sessions with the roll numbers they run between.
// Open a session to see its votes, and a vote to see how every member voted —
// congress.gov/roll-call-votes, drawn from our own two records.
//
// The two records do not come from one place. congress.gov's vote API is
// House-only, so the Senate's votes are loaded from the Senate's own XML; the
// page says which is which rather than pretending to one source.

const title = "Roll call votes"
const description = "Every recorded vote of the House and the Senate, by congress and session, down to how each member voted."

export const metadata = { title, description }
export const revalidate = 3600

export default async function RollCallVotesPage() {
  const sessions = await getRollCallSessions().catch(() => [])
  const congresses = [...new Set(sessions.map((s) => s.congress))].sort((a, b) => b - a)
  const votes = sessions.reduce((sum, s) => sum + s.votes, 0)
  const positions = sessions.reduce((sum, s) => sum + s.positions, 0)
  const toc = congresses.map((c) => ({ title: congressName(1789 + (c - 1) * 2), url: `#congress-${c}`, depth: 2 }))

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/roll-call-votes"
      previous={{ name: "Laws", url: "/public-laws" }}
      next={{ name: "Finance", url: "/money" }}
      rail={<DocsTableOfContents toc={toc} />}
    >
      <p>
        A roll call is the vote itself: the question put, the result, and the name of every member who answered it.{" "}
        <code>{fmtNumber(votes)}</code> of them are on file, carrying <code>{fmtNumber(positions)}</code> recorded positions.
        Open a session for its votes, and a vote for its members.
      </p>
      <p>
        The two chambers publish differently, and the page keeps the difference visible. The House&rsquo;s votes come from
        congress.gov&rsquo;s vote API. The Senate has no API at all — congress.gov publishes House votes only — so the
        Senate&rsquo;s come from the Senate&rsquo;s own XML, vote by vote, and carry an absence where the House counts a
        member not voting.
      </p>
      {congresses.length === 0 && <p>No roll calls on file yet.</p>}
      {congresses.map((congress) => (
        <div key={congress}>
          <hr />
          <H2 id={`congress-${congress}`}>{congressName(1789 + (congress - 1) * 2)}</H2>
          <p>
            {(() => {
              const mine = sessions.filter((s) => s.congress === congress)
              const total = mine.reduce((sum, s) => sum + s.votes, 0)
              return (
                <>
                  <code>{fmtNumber(total)}</code> recorded {total === 1 ? "vote" : "votes"} across{" "}
                  {mine.length} {mine.length === 1 ? "session" : "sessions"} of the two chambers.
                </>
              )
            })()}
          </p>
          <Table>
            <thead>
              <tr>
                <th className="w-[22%]">Chamber</th>
                <th className="w-[22%]">Session</th>
                <th className="w-[24%]">Sitting</th>
                <th className="w-[10%] text-right">Rolls</th>
                <th className="w-[10%] text-right">On bills</th>
                <th className="w-[12%] pr-8 text-right">Votes</th>
              </tr>
            </thead>
            <tbody>
              {sessions
                .filter((s) => s.congress === congress)
                .map((s) => (
                  <tr key={sessionSlug(s.chamber, s.congress, s.session)}>
                    <td>
                      <Link href={`/roll-call-votes/${sessionSlug(s.chamber, s.congress, s.session)}`}>{chamberName(s.chamber)}</Link>
                    </td>
                    <td>{sessionName(s.session)}</td>
                    <td className="whitespace-nowrap">
                      {s.first_date ? fmtDate(s.first_date, false) : "—"}
                      {s.last_date ? ` – ${fmtDate(s.last_date)}` : ""}
                    </td>
                    <td className="text-right tabular-nums">
                      {s.first_roll}–{s.last_roll}
                    </td>
                    <td className="text-right tabular-nums">{fmtNumber(s.on_bills)}</td>
                    <td className="pr-8 text-right tabular-nums">{fmtNumber(s.votes)}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      ))}
    </DocsPage>
  )
}
