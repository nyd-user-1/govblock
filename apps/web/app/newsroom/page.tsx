import type { Metadata } from "next"

import desks from "@/lib/data/stream-desks.json"
import * as F from "@/lib/fixtures"
import { getNewsroom } from "@/lib/policy/newsroom"
import { getStream } from "@/lib/policy/stream"
import { NewsroomPage } from "@/components/newsroom"

// Ported from livingston-v3 app/(app)/newsroom/page.tsx. Congress is the desk.
// Read from mv_newsroom_latest and mv_stream_latest, rebuilt every hour.
export const metadata: Metadata = { title: "News Room", description: "What the legislature did, newest first." }
export const revalidate = 3600

const DESKS = ["NY", "TX", "CA", "US"]

export default async function Newsroom() {
  const state = F.STATE
  const [{ data, session, source }, others] = await Promise.all([
    getNewsroom(state),
    getStream({ states: DESKS.filter((d) => d !== state).slice(0, 3), limit: 2 }),
  ])
  if (!data) return <p className="container-wrapper px-6 py-10 text-sm text-muted-foreground">Nothing on file for this desk.</p>
  return (
    <div data-source={source}>
      <NewsroomPage data={data} state={state} session={session ?? F.SESSION} others={others.source === "database" ? others.groups : desks} />
    </div>
  )
}
