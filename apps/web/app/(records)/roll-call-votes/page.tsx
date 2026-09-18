import { fmtDate } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { chamberName, getRollCallSessions, sessionName, sessionSlug } from "@/lib/policy/roll-call-queries"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2 } from "@/components/typeset"

import { SessionViews } from "./session-views"

// Roll-call votes, on the Bulk Datasets page's shape: a section per congress,
// and under it each chamber's sessions as a table or as cards, the block alone (Brendan, 2026-09-17:
// no prose above it, and Rolls as the last roll number rather than a range).
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
  const toc = congresses.map((c) => ({ title: congressName(1789 + (c - 1) * 2), url: `#congress-${c}`, depth: 2 }))

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/roll-call-votes"
      previous={{ name: "Finance", url: "/money" }}
      next={{ name: "Finance", url: "/money" }}
      rail={<DocsTableOfContents toc={toc} />}
    >
      {congresses.length === 0 && <p>No roll calls on file yet.</p>}
      {/* A section per congress, a rule between each and the same air above
          and below it, as the simulator's sections stand (2026-09-17). */}
      {congresses.map((congress, i) => (
        <section key={congress}>
          {i > 0 && <hr className="my-[45px] border-0 border-t border-border" />}
          <H2 id={`congress-${congress}`}>{congressName(1789 + (congress - 1) * 2)}</H2>
          <SessionViews
            rows={sessions
              .filter((s) => s.congress === congress)
              .map((s) => ({
                key: sessionSlug(s.chamber, s.congress, s.session),
                href: `/roll-call-votes/${sessionSlug(s.chamber, s.congress, s.session)}`,
                chamber: chamberName(s.chamber) as "House" | "Senate",
                session: sessionName(s.session),
                sitting: `${s.first_date ? fmtDate(s.first_date, false) : "—"}${s.last_date ? ` – ${fmtDate(s.last_date)}` : ""}`,
                rolls: s.last_roll,
                onBills: s.on_bills,
                votes: s.votes,
              }))}
          />
        </section>
      ))}
    </DocsPage>
  )
}
