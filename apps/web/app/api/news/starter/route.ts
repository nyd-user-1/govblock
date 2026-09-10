import { NextResponse } from "next/server"

import { isJurisdiction } from "@/lib/filters"
import { generateWireBrief } from "@/lib/news/wire"
import { getTodaysBrief } from "@/lib/policy/news"

// POST /api/news/starter {state} — the cheap wire summary for a desk.
//
// So no desk is bare before anyone has paid for the Reporter's real briefing.
// Written from the crawled press in one model call, about two cents a desk.
// Skipped when the desk already has anything filed today.

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { state?: string }
  const state = String(body.state ?? "").toUpperCase()
  if (!isJurisdiction(state))
    return NextResponse.json({ error: "state required" }, { status: 400 })

  const existing = await getTodaysBrief(state)
  if (existing)
    return NextResponse.json({ state, brief: existing, fresh: false })

  try {
    const brief = await generateWireBrief(state)
    if (!brief)
      return NextResponse.json({
        state,
        brief: null,
        fresh: false,
        reason: "Too little press on this desk to summarise.",
      })
    return NextResponse.json({ state, brief, fresh: true })
  } catch (error) {
    console.error("wire: brief failed", error)
    return NextResponse.json({ error: "The wire brief failed." }, { status: 502 })
  }
}
