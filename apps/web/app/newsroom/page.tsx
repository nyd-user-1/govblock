import type { Metadata } from "next"

import desks from "@/lib/data/stream-desks.json"
import type { StreamGroup } from "@/lib/policy/stream"
import * as F from "@/lib/fixtures"
import { getNewsroom } from "@/lib/policy/newsroom"
import { getStream } from "@/lib/policy/stream"
import { NewsroomScoped } from "@/components/newsroom-scoped"

// Ported from livingston-v3 app/(app)/newsroom/page.tsx. Congress is prerendered
// from mv_newsroom_latest and mv_stream_latest, rebuilt every hour; any other
// jurisdiction is picked up on the client, so the route stays static and the CDN
// caches each desk separately.
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
      <NewsroomScoped
        initial={data}
        initialState={state}
        initialSession={session ?? F.SESSION}
        initialOthers={others.source === "database" ? others.groups : (desks as unknown as StreamGroup[])}
        desks={DESKS}
      />
    </div>
  )
}
