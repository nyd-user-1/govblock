import { NextResponse } from "next/server"

import { resolveWorks } from "@/lib/typeset/resolve"

// Cited Works resolved against the corpus (window 6, 2026-09-14): the reader
// finds a document's citations itself (lib/typeset/cite.ts) and asks here
// which of the Works they name are stored, as of the citing document's date.
// Only the index is read: what is stored and when, never the text.
//
//   POST /api/typeset/cite  { works: string[], at?: "YYYY-MM-DD", citing?: "/us/bill/119/hr/6644@2026-06-25_enr" }

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { works?: unknown; at?: unknown; citing?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }
  const works = Array.isArray(body.works) ? body.works.filter((w): w is string => typeof w === "string") : []
  if (!works.length) return NextResponse.json({ resolutions: {} })
  try {
    const resolutions = await resolveWorks(works, typeof body.at === "string" ? body.at : null, typeof body.citing === "string" ? body.citing : null)
    return NextResponse.json({ resolutions }, { headers: { "cache-control": "private, max-age=300" } })
  } catch (error) {
    return NextResponse.json({ resolutions: {}, error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
