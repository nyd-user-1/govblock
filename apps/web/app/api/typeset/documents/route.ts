import { NextResponse } from "next/server"

import { storeTypesetDocument } from "@/lib/typeset/document"
import { TYPESET_BUILDER } from "@/lib/typeset/document-store"

// Builds a bill version's Typeset document and stores it in typeset_documents
// (typeset-perf, 2026-09-13), for scripts/typeset/backfill.mjs. The builder
// lives in the app (USLM, the HTML, Plate's deserializer, the static
// snapshot), so the backfill asks the app to build rather than repeating it.
//
//   GET /api/typeset/documents?builder=1                   the builder version rows are stored under
//   GET /api/typeset/documents?bill=<id>[&version=<doc>]   build and store; waits for the write
//
// Open in development. Anywhere else it needs `Authorization: Bearer
// $TYPESET_BACKFILL_TOKEN`, and with no token configured it is closed.

export const dynamic = "force-dynamic"

function allowed(request: Request) {
  if (process.env.NODE_ENV === "development") return true
  const token = process.env.TYPESET_BACKFILL_TOKEN
  return !!token && request.headers.get("authorization") === `Bearer ${token}`
}

export async function GET(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "not allowed" }, { status: 403 })
  const sp = new URL(request.url).searchParams
  if (sp.get("builder") === "1") return NextResponse.json({ builder: TYPESET_BUILDER })

  const billId = Number(sp.get("bill") ?? 0)
  if (!Number.isInteger(billId) || billId <= 0) return NextResponse.json({ error: "bill required" }, { status: 400 })
  const version = Number(sp.get("version") ?? 0) || undefined

  const started = performance.now()
  const result = await storeTypesetDocument(billId, version)
  if (!result) return NextResponse.json({ error: "no such bill" }, { status: 404 })
  return NextResponse.json({ bill: billId, ...result, ms: Math.round(performance.now() - started) })
}
