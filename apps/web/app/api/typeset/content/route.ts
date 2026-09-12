import { billCitation } from "@/lib/policy/congress"
import { NextResponse } from "next/server"

import { changelogHtml, esc } from "@/lib/policy/bill-html"
import { fetchUslm, plainTextHtml } from "@/lib/policy/bill-uslm"
import { getBill, getBillText } from "@/lib/policy/queries"

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
//   GET /api/typeset/content?item=article|changelog&bill=<id>[&version=<doc>]

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const item = sp.get("item") === "changelog" ? "changelog" : "article"
  const billId = Number(sp.get("bill") ?? 0)
  if (!Number.isInteger(billId) || billId <= 0)
    return NextResponse.json({ error: "bill required" }, { status: 400 })
  const bill = await getBill(billId)
  if (!bill)
    return NextResponse.json({ error: "no such bill" }, { status: 404 })

  if (item === "changelog") {
    return NextResponse.json({
      item,
      bill: bill.bill_number,
      title: bill.title,
      html: changelogHtml(bill),
    })
  }

  const version = Number(sp.get("version") ?? 0) || undefined
  const text = await getBillText(bill.bill_id, version)
  const shown = text
    ? `${text.document_desc ?? text.version ?? ""}${text.date ? ` (${text.date})` : ""}`.trim()
    : ""
  const uslm = text ? await fetchUslm(text.url) : null
  // The document names itself — "H. R. 5366", the way the GPO sets it — which
  // beats the record's own key ("HB5366") at the top of a page a reader reads.
  const heading = uslm?.title ?? billCitation(bill.bill_number, bill.state)
  const head = `<h1>${esc(heading)}</h1><p><em>${esc(bill.title)}</em></p>${shown ? `<p><strong>Shown here:</strong> ${esc(shown)}</p>` : ""}`
  const body = uslm
    ? uslm.html
    : text
      ? plainTextHtml(text.text)
      : "<p>The text of this bill has not been fetched yet.</p>"
  const html = `${head}${body}`
  return NextResponse.json({
    item,
    bill: bill.bill_number,
    title: bill.title,
    html,
  })
}
