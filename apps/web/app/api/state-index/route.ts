import { NextResponse } from "next/server"

import { getStateIndex } from "@/lib/policy/state-index"

// The jurisdictions table's rows, for the root page's second section
// (Brendan, 2026-09-18). Asked for only when a reader switches the section to
// its table, never on page load: the law count alone reads every row of
// "Laws" (about 4 s cold), and the root page should not wait on it. The
// queries' own cache holds the answer for a day; the CDN holds it an hour.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await getStateIndex()
    return NextResponse.json({ rows }, { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("state-index failed", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
