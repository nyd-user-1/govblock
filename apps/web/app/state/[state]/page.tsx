import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { isJurisdiction, stateName } from "@/lib/filters"
import { getSessions } from "@/lib/policy/db-queries"
import { chambersOf } from "@/lib/workspace/datasets"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"

// /state/[state] (Brendan, 2026-09-13): the hub for one jurisdiction —
// reserved here so every state has one address, and filled as the pieces
// land. Today: the flag, the chambers, the sessions the record holds, and
// the doors to its charts, bills, members, committees, desk, laws and news.
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
  const lower = s.toLowerCase()
  const doors = [
    ["Charts", `/state/${lower}/charts`],
    ["Bills", `/bills/${lower}`],
    ["Members", `/members?state=${s}`],
    ["Committees", `/committees?state=${s}`],
    ["Desk", `/desk/${lower}`],
    ["Laws", `/laws/${lower}`],
    ["News", `/news/${lower}`],
    ["Data", `/workspace/data/${lower}`],
  ]
  return (
    <div className="container-wrapper flex flex-1 flex-col gap-10 px-6 py-12">
      <div className="flex items-center gap-4">
        <FlagChip state={s} width={64} />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <p className="text-muted-foreground">{sessions.length} sessions on the record</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        {chambersOf(s).map((chamber) => (
          <Link key={chamber} href={`/bills?state=${s}&chamber=${encodeURIComponent(chamber)}`} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 no-underline hover:bg-accent/40">
            <ChamberSeal state={s} chamber={chamber} size={32} />
            <span className="text-sm font-medium">{name === "Congress" ? "U.S." : name} {chamber}</span>
          </Link>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {doors.map(([label, href]) => (
          <Link key={href} href={href} className="rounded-xl border bg-card p-4 text-sm font-medium no-underline hover:bg-accent/40">
            {label}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3 lg:grid-cols-5">
          {sessions.map((row) => (
            <li key={String(row.session_id)} className="m-0 p-0">
              <Link href={`/bills?state=${s}&session=${row.session_id}`} className="flex items-baseline justify-between rounded-lg border px-3 py-2 text-sm no-underline hover:bg-accent/40">
                <span>{String((row as { session_title?: string | null }).session_title ?? row.session_id)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{Number(row.bills).toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
