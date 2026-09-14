import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { isJurisdiction, stateName } from "@/lib/filters"
import { getStateStats } from "@/lib/policy/state-stats"
import { CHARTS, StateChart } from "@/components/charts/state-charts"
import { FlagChip } from "@/components/policy/imagery"

// /state/[state]/charts (Brendan, 2026-09-13): what the record holds about
// one legislature, as charts, on the stats page LegiScan draws for a state —
// every number from our own tables, every chart plain SVG rendered on the
// server, revalidated hourly.
export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const s = state.toUpperCase()
  const name = s === "US" ? "Congress" : stateName(s)
  return { title: `${name} charts`, description: `${name} by the numbers: sessions, sponsors, seats, committees.` }
}

function Panel({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`flex flex-col gap-4 rounded-xl border bg-card p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default async function StateChartsPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const s = state.toUpperCase()
  if (!isJurisdiction(s)) notFound()
  const stats = await getStateStats(s)
  const current = stats.sessions.find((x) => x.session === stats.session)
  const wide = new Set(["seats", "introduced", "parties", "sponsorship", "enacted", "passed", "committees", "committee-series"])
  return (
    <div className="container-wrapper flex flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <FlagChip state={s} width={56} />
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight">{stats.name} charts</h1>
            <p className="text-sm text-muted-foreground">
              Session {stats.session}
              {current ? ` · ${(current.bills + current.resolutions).toLocaleString()} bills and resolutions` : ""} · {stats.sessions.length} sessions on the record
            </p>
          </div>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href={`/state/${s.toLowerCase()}`} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {stats.name}
          </Link>
          <Link href={`/charts/studio?state=${s}`} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Studio
          </Link>
        </nav>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {CHARTS.map((c) => (
          <Panel key={c.id} title={c.title} wide={wide.has(c.id)}>
            <StateChart id={c.id} stats={stats} />
          </Panel>
        ))}
      </div>
    </div>
  )
}
