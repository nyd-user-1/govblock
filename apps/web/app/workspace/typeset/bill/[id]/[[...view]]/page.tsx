import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { TypesetBillRoute, typesetBillMetadata } from "@/components/workspace/typeset-bill-route"
import { getBill } from "@/lib/policy/queries"
import { billWork } from "@/lib/xml/address"
import { typesetHref, viewFromSlug, viewSpec } from "@/lib/typeset/views"

// /workspace/typeset/bill/{id}[/{view}] (Brendan, 2026-09-12), the bill's
// old URL. Since 2026-09-15 a bill lives at its address
// (/workspace/typeset/us/bill/119/hr/6644/<view>) and this sends the reader
// there, query and all, because the rest of the site still links here by id.
// A bill with no address is drawn here as before.

type Params = Promise<{ id: string; view?: string[] }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, view } = await params
  const key = viewFromSlug(view?.[0])
  const bill = /^\d+$/.test(id) ? await getBill(Number(id)) : null
  return bill && key ? typesetBillMetadata(bill, key) : { title: "Typeset" }
}

export default async function TypesetBillPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id, view } = await params
  const key = viewFromSlug(view?.[0])
  if (!key || (view?.length ?? 0) > 1 || !/^\d+$/.test(id)) notFound()
  const bill = await getBill(Number(id))
  if (!bill) notFound()
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query.set(k, v)
  const address = billWork(bill)
  if (address) redirect(typesetHref(address, key, query))
  // A slug the routes used to have (comp, versions, actions) opens its view at the view's own address.
  if (view?.[0] && view[0] !== viewSpec(key).slug) redirect(typesetHref(bill.bill_id, key, query))
  return <TypesetBillRoute bill={bill} view={key} address={null} expression={null} version={query.get("version") ?? undefined} />
}
