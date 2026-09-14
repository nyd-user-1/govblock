import { NextResponse } from "next/server"
import { gzipSync } from "node:zlib"

import { currentSession, gate } from "@/lib/entitlements-server"
import { getBill } from "@/lib/policy/queries"
import { getXmlDocument, type XmlDocument } from "@/lib/typeset/xml-document"

// The XML view's document (window 1, 2026-09-14): a printing as the reader's
// ProseMirror JSON, built from its USLM by lib/typeset/xml-document.ts. The
// page has already painted the same document as HTML; the editor takes over
// from this.
//
//   GET /api/typeset/xml?bill=<id>[&version=<document id>]

export const dynamic = "force-dynamic"

// The development server does not compress route responses, and H.R. 6644 is
// 1.8 MB of JSON, so each built body is kept gzipped beside its document.
const bodies = new WeakMap<XmlDocument, { json: string; gzip: Buffer }>()

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const billId = Number(sp.get("bill") ?? 0)
  if (!Number.isInteger(billId) || billId <= 0) return NextResponse.json({ error: "bill required" }, { status: 400 })
  const bill = await getBill(billId)
  if (!bill) return NextResponse.json({ error: "no such bill" }, { status: 404 })
  const { refusal } = await gate(request, { state: bill.state, session: bill.session_id, current: await currentSession(bill.state).catch(() => null), entity: "bills" })
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: { "cache-control": "private, no-store" } })

  const version = Number(sp.get("version") ?? 0) || undefined
  const document = await getXmlDocument(bill.bill_id, version, bill)
  if (!document) return NextResponse.json({ error: "no such bill" }, { status: 404 })
  let body = bodies.get(document)
  if (!body) {
    const { html: _html, ...rest } = document
    const json = JSON.stringify(rest)
    body = { json, gzip: gzipSync(json) }
    bodies.set(document, body)
  }
  const gzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")
  return new NextResponse(gzip ? new Uint8Array(body.gzip) : body.json, {
    headers: { "content-type": "application/json", vary: "accept-encoding", ...(gzip ? { "content-encoding": "gzip" } : {}) },
  })
}
