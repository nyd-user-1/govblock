import { NextResponse } from "next/server"

import { STATE_NAMES } from "@/lib/filters"
import { DATASET_FAMILY_NAMES, type DatasetFamily, datasetStream } from "@/lib/policy/datasets"

// A session as a file: /api/dataset/us/2025/bills.json, .../bills.csv
// (Brendan, 2026-09-05). Streamed from Aurora a thousand rows at a time and
// cached at the edge for a day, since a session's record changes nightly at
// most. The families are the record's own tables, not the texts.

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ state: string; session: string; file: string }> }) {
  const { state: rawState, session: rawSession, file } = await params
  const state = rawState.toUpperCase()
  const session = Number(rawSession)
  const match = /^([a-z]+)\.(json|csv)$/.exec(file)
  if (!STATE_NAMES[state] || !Number.isInteger(session) || session < 1900 || !match || !DATASET_FAMILY_NAMES.includes(match[1] as DatasetFamily)) {
    return NextResponse.json({ error: "unknown dataset", state: rawState, session: rawSession, file }, { status: 404 })
  }
  const family = match[1] as DatasetFamily
  const format = match[2] as "json" | "csv"
  const name = `${state.toLowerCase()}-${session}-${family}.${format}`
  return new Response(datasetStream(family, state, session, format), {
    headers: {
      "content-type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  })
}
