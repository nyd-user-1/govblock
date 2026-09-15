import { NextResponse } from "next/server"
import { gzipSync } from "node:zlib"

import { currentSession, gate } from "@/lib/entitlements-server"
import { askOf, findExpression, getExpressionDocument, type ExpressionDocument } from "@/lib/typeset/expression-document"

// A stored Expression as the XML reader's ProseMirror JSON (window 4,
// 2026-09-14), by address: what /workspace/typeset/work/<address> mounts after
// its first paint. Gated as the record it is: a printing as its bill, a
// section as the laws.
//
//   GET /api/typeset/work?address=/us-ny/code/agm/s3[&at=YYYY-MM-DD]

export const dynamic = "force-dynamic"

const bodies = new WeakMap<ExpressionDocument, { json: string; gzip: Buffer }>()

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const address = sp.get("address") ?? ""
  const at = sp.get("at")
  if (!address.startsWith("/")) return NextResponse.json({ error: "address required" }, { status: 400 })
  if (at && !/^\d{4}-\d{2}-\d{2}$/.test(at)) return NextResponse.json({ error: "at is a date, YYYY-MM-DD" }, { status: 400 })

  const found = await findExpression(address, at)
  if (!found) return NextResponse.json({ error: at ? `nothing stored at ${address} in force on ${at}` : `nothing stored at ${address}` }, { status: 404 })
  const ask = askOf(found.row)
  const { refusal } = await gate(request, { ...ask, current: ask.entity === "bills" ? await currentSession(ask.state!).catch(() => null) : undefined })
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: { "cache-control": "private, no-store" } })

  const document = await getExpressionDocument(found.row, found.portion)
  let body = bodies.get(document)
  if (!body) {
    const { html: _html, meta, ...rest } = document
    const json = JSON.stringify({ ...meta, ...rest })
    body = { json, gzip: gzipSync(json) }
    bodies.set(document, body)
  }
  const gzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")
  return new NextResponse(gzip ? new Uint8Array(body.gzip) : body.json, {
    headers: { "content-type": "application/json", vary: "accept-encoding", "cache-control": "private, max-age=300", ...(gzip ? { "content-encoding": "gzip" } : {}) },
  })
}
