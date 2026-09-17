import { NextResponse } from "next/server"

import { getCongressLive } from "@/lib/policy/live-congress"
import { getStatesLive } from "@/lib/policy/live-states"
import { getLiveStream, type LiveEvent } from "@/lib/policy/live-stream"

// /live's feed: Congress from the Clerk and congress.gov as they publish
// (lib/policy/live-congress.ts), and every state that has an adapter from its
// own legislature (lib/policy/live-states.ts). A state with no adapter yet
// falls back to the stored history, and only for the days its own source does
// not answer for. The last seven days with an event, newest first. The page
// polls every thirty seconds; the Clerk's day file is re-read no more often.

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [congress, states, stored] = await Promise.all([getCongressLive(), getStatesLive(), getLiveStream()])
    const firstParty = new Set(["US", ...states.states])
    const all: LiveEvent[] = [...congress, ...states.events, ...stored.filter((e) => !firstParty.has(e.state))]
    const days = new Set([...new Set(all.map((e) => e.date))].sort().reverse().slice(0, 7))
    const events = all
      .filter((e) => days.has(e.date))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.at ?? "").localeCompare(a.at ?? "") || (b.seq ?? 0) - (a.seq ?? 0))
    return NextResponse.json({ events }, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=300" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("live stream failed", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
