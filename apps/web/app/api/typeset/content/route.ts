import { NextResponse } from "next/server"
import { gzipSync } from "node:zlib"

import { currentSession, gate } from "@/lib/entitlements-server"
import { changelogHtml } from "@/lib/policy/bill-html"
import { getBill } from "@/lib/policy/queries"
import { getTypesetDocument, type TypesetDocument } from "@/lib/typeset/document"

// What the Typeset editor opens with (2026-09-09): one of the bill's pages
// as HTML. `article` is the official text as the Government Publishing Office
// prints it and `changelog` is every action by date.
//
// The article is built from the document's USLM XML (2026-09-10), because that
// is where a bill's structure lives — <section>, <enum>, <header>, and the
// levels beneath them become headings and paragraphs the editor can work with.
// It used to be one <pre><code> block of the stored plain text, which is the
// same document with its tags stripped: nothing to edit and nothing for the
// typeset to style. Documents with no XML behind them fall back to reading the
// levels out of that plain text.
//
//   GET /api/typeset/content?item=article|changelog&bill=<id>[&version=<doc>][&value=1]

export const dynamic = "force-dynamic"

// The article is built and kept by lib/typeset/document.ts. The route keeps
// each built article's JSON gzipped as well: the development server does not
// compress route responses, and 358 KB of JSON took 0.3–0.7 s through the
// tunnel (typeset-perf, 2026-09-13).
type Body = { json: string; gzip: Buffer }
const bodies = new WeakMap<TypesetDocument, { html?: Body; value?: Body }>()

function articleResponse(request: Request, article: Body) {
  const gzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")
  return new NextResponse(gzip ? new Uint8Array(article.gzip) : article.json, {
    headers: {
      "content-type": "application/json",
      vary: "accept-encoding",
      ...(gzip ? { "content-encoding": "gzip" } : {}),
    },
  })
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const item = sp.get("item") === "changelog" ? "changelog" : "article"
  const billId = Number(sp.get("bill") ?? 0)
  if (!Number.isInteger(billId) || billId <= 0)
    return NextResponse.json({ error: "bill required" }, { status: 400 })
  const bill = await getBill(billId)
  if (!bill)
    return NextResponse.json({ error: "no such bill" }, { status: 404 })
  // The bill's jurisdiction and session decide who may read it (2026-09-13).
  const { refusal } = await gate(request, { state: bill.state, session: bill.session_id, current: await currentSession(bill.state).catch(() => null), entity: "bills" })
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: { "cache-control": "private, no-store" } })

  if (item === "changelog") {
    return NextResponse.json({
      item,
      bill: bill.bill_number,
      title: bill.title,
      html: changelogHtml(bill),
    })
  }

  const version = Number(sp.get("version") ?? 0) || undefined
  const document = await getTypesetDocument(bill.bill_id, version, bill)
  if (!document) return NextResponse.json({ error: "no such bill" }, { status: 404 })
  // `&value=1` adds the HTML already read into Slate, so the editor can skip
  // parsing it; it doubles the payload, so it is asked for, not sent by default.
  const withValue = sp.get("value") === "1"
  let kept = bodies.get(document)
  if (!kept) {
    kept = {}
    bodies.set(document, kept)
  }
  const variant = withValue ? "value" : "html"
  let body = kept[variant]
  if (!body) {
    const json = JSON.stringify({ item, bill: bill.bill_number, title: bill.title, html: document.html, ...(withValue ? { value: document.value } : {}) })
    body = { json, gzip: gzipSync(json) }
    kept[variant] = body
  }
  return articleResponse(request, body)
}
