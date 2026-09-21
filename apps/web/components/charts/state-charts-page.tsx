import * as React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconCheck } from "@tabler/icons-react"

import { isJurisdiction } from "@/lib/filters"
import { neighbours } from "@/lib/jurisdictions"
import { getStateStats } from "@/lib/policy/state-stats"
import { CHARTS, StateChart } from "@/components/charts/state-charts"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { FlagChip } from "@/components/policy/imagery"
import { RECORD_FLAG } from "@/components/record-header"
import { H2 } from "@/components/typeset"

// A jurisdiction's charts on the docs shell (Brendan, 2026-09-20): the flag
// before the name, the facts as the sub-header, the charts one to a section
// down the column with the shell's index of them in the right rail. Copy
// page's place is the Session menu: every session on file, each an address of
// its own (/state/ky/charts/2024) so a session's page is rendered once and
// kept the hour, as the latest is, rather than read from the database on every
// view. The head's arrows are the jurisdictions either side, A to Z.
export async function StateChartsPage({ state, session }: { state: string; /** The session the one-session charts read; the latest without it. */ session?: number }) {
  const s = state.toUpperCase()
  if (!isJurisdiction(s)) notFound()
  const stats = await getStateStats(s, session)
  if (session !== undefined && !stats.sessions.some((x) => x.session === session)) notFound()
  const lower = s.toLowerCase()
  const current = stats.sessions.find((x) => x.session === stats.session)
  const facts = [`Session ${stats.session}`, current ? `${(current.bills + current.resolutions).toLocaleString()} bills and resolutions` : null, `${stats.sessions.length} sessions`].filter(Boolean).join(" · ")
  const beside = neighbours(s)
  // A chart with nothing to draw for this session takes no section, and no line in the index.
  const charts = CHARTS.map((c) => ({ ...c, chart: StateChart({ id: c.id, stats }) })).filter((c) => c.chart)
  const menu = [...stats.sessions]
    .sort((a, b) => b.session - a.session)
    .map((x) => (
      <Link key={x.session} href={`/state/${lower}/charts/${x.session}`} className="flex w-full items-center justify-between gap-6 tabular-nums">
        {x.session}
        {x.session === stats.session && <IconCheck aria-label="Shown" className="size-4" />}
      </Link>
    ))
  return (
    <DocsPage
      media={<FlagChip state={s} width={RECORD_FLAG} />}
      title={`${stats.name} charts`}
      description={facts}
      slug={`/state/${lower}/charts${session ? `/${session}` : ""}`}
      picker={{ label: "Session", menu }}
      previous={beside ? { name: `${beside.previous.name} charts`, url: `/state/${beside.previous.state.toLowerCase()}/charts` } : undefined}
      next={beside ? { name: `${beside.next.name} charts`, url: `/state/${beside.next.state.toLowerCase()}/charts` } : { name: stats.name, url: `/state/${lower}` }}
      rail={<DocsTableOfContents toc={charts.map((c) => ({ title: c.title, url: `#${c.id}`, depth: 2 }))} />}
    >
      {charts.map((c, i) => (
        <React.Fragment key={c.id}>
          {i > 0 && <hr />}
          <H2 id={c.id}>{c.title}</H2>
          <div data-not-typeset="true" className="mt-6 rounded-xl border bg-card p-5">
            {c.chart}
          </div>
        </React.Fragment>
      ))}
    </DocsPage>
  )
}
