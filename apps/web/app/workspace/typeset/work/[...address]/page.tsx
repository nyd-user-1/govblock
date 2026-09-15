import { notFound, permanentRedirect } from "next/navigation"

import { findExpression } from "@/lib/typeset/expression-document"
import { billHrefOfWork } from "@/lib/typeset/bill-href"
import { statuteHref } from "@/lib/xml/library"

// /workspace/typeset/work/<address>: no page of its own any more (Brendan,
// 2026-09-15). A bill's address goes to the bill's XML view,
// /workspace/typeset/bill/<id>/xml; a statute's to
// /workspace/typeset/statute/<jurisdiction>/<code>/<section>. Links built by
// workHref still come through here for bills, because the bill id is a lookup.

type Params = Promise<{ address: string[] }>
type Search = Promise<{ at?: string }>

const addressOf = (parts: string[]) => `/${parts.map((p) => decodeURIComponent(p)).join("/")}`
const dateOf = (at: string | undefined) => (at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null)

export default async function TypesetWorkDoor({ params, searchParams }: { params: Params; searchParams: Search }) {
  const address = addressOf((await params).address)
  const at = dateOf((await searchParams).at)
  if (address.split("/")[2] === "bill") {
    const found = await findExpression(address, at).catch(() => null)
    const billHref = found ? await billHrefOfWork(found.row.work) : null
    if (billHref) permanentRedirect(billHref)
    if (!found) notFound()
  }
  permanentRedirect(statuteHref(address, at))
}
