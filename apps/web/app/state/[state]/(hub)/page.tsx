import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight } from "lucide-react"

import { isJurisdiction, stateName } from "@/lib/filters"
import { jurisdiction, neighbours, span } from "@/lib/jurisdictions"
import { getSessions } from "@/lib/policy/db-queries"
import { chambersOf } from "@/lib/workspace/datasets"
import { DocsPage } from "@/components/docs-page"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { RECORD_FLAG } from "@/components/record-header"
import { H2 } from "@/components/typeset"

// /state/[state] (Brendan, 2026-09-13): the hub for one jurisdiction —
// reserved here so every state has one address, and filled as the pieces
// land. Today: the flag, the chambers, the sessions the record holds, and
// the doors to its charts, bills, members, committees, desk, laws and news.
//
// In DocsPage (Brendan, 2026-09-20), as /state is: the name is the shell's
// title and the years and sessions on file its sub-header, from the frozen
// counts; the flag stands before the name, as the seal stands before a
// member. Until then the page drew both site rails around a column of its
// own, wider than every page beside it.
export const revalidate = 3600

const code = (s: string) => s.toUpperCase()


export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const name = code(state) === "US" ? "Congress" : stateName(code(state))
  return { title: name, description: `${name}: the record, its numbers, and its people.` }
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const s = code(state)
  if (!isJurisdiction(s)) notFound()
  const name = s === "US" ? "Congress" : stateName(s)
  const sessions = await getSessions(s)
  const counts = jurisdiction(s)
  // The head's arrows are the jurisdictions either side, A to Z (Brendan, 2026-09-20).
  const beside = neighbours(s)
  const lower = s.toLowerCase()
  // A to Z (Brendan, 2026-09-20).
  const doors = [
    ["Bills", `/bills/${lower}`],
    ["Charts", `/state/${lower}/charts`],
    ["Committees", `/committees?state=${s}`],
    ["Data", `/workspace/data/${lower}`],
    ["Desk", `/desk/${lower}`],
    ["Laws", `/laws/${lower}`],
    ["Members", `/members?state=${s}`],
    ["News", `/news/${lower}`],
  ]
  return (
    <DocsPage
      media={<FlagChip state={s} width={RECORD_FLAG} />}
      title={name}
      description={counts ? span(counts) : `${sessions.length} sessions`}
      slug={`/state/${lower}`}
      previous={beside ? { name: beside.previous.name, url: `/state/${beside.previous.state.toLowerCase()}` } : { name: "Jurisdictions", url: "/state" }}
      next={beside ? { name: beside.next.name, url: `/state/${beside.next.state.toLowerCase()}` } : { name: "Bills", url: `/bills/${lower}` }}
    >
      {/* Three sections under the shell's own headings, a rule between them (Brendan, 2026-09-20). */}
      <H2>Chambers</H2>
      {/* The index card standard, two across: the seal, the name, the arrow rising on hover. */}
      <ProjectGrid data-not-typeset="true" className="mt-6">
        {chambersOf(s).map((chamber) => (
          <ProjectCard key={chamber} href={`/bills?state=${s}&chamber=${encodeURIComponent(chamber)}`} media={<ChamberSeal state={s} chamber={chamber} size={28} />} title={`${name === "Congress" ? "U.S." : name} ${chamber}`} meta="Bills" arrow />
        ))}
      </ProjectGrid>
      <hr />
      <H2>Resources</H2>
      <div data-not-typeset="true" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {doors.map(([label, href]) => (
          <Link key={href} href={href} className="group/door flex items-center justify-between gap-2 rounded-xl border bg-card p-4 text-sm font-medium no-underline transition-colors hover:bg-accent/40">
            {label}
            <ArrowUpRight aria-hidden className="size-4 shrink-0 translate-x-[-4px] translate-y-[4px] text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/door:translate-x-0 group-hover/door:translate-y-0 group-hover/door:text-foreground group-hover/door:opacity-100 group-focus-visible/door:opacity-100" />
          </Link>
        ))}
      </div>
      <hr />
      <H2>Sessions</H2>
      {/* Three across: the shell's column is 40rem, and five left a session's title no room. */}
      <ul data-not-typeset="true" className="m-0 mt-6 grid list-none gap-2 p-0 sm:grid-cols-3">
        {sessions.map((row) => (
          <li key={String(row.session_id)} className="m-0 p-0">
            <Link href={`/bills?state=${s}&session=${row.session_id}`} className="flex items-baseline justify-between rounded-lg border px-3 py-2 text-sm no-underline hover:bg-accent/40">
              <span>{String((row as { session_title?: string | null }).session_title ?? row.session_id)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{Number(row.bills).toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DocsPage>
  )
}
