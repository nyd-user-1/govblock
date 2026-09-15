import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { TypesetBillRoute, typesetBillMetadata } from "@/components/workspace/typeset-bill-route"
import { dateOfAt, TypesetStatuteRoute, typesetStatuteMetadata } from "@/components/workspace/typeset-statute-route"
import { getBill } from "@/lib/policy/queries"
import { billIdOfWork } from "@/lib/typeset/bill-href"
import { typesetHref, viewFromSlug, viewSpec, VIEW_SLUGS } from "@/lib/typeset/views"
import { addressOfTypesetPath, formatAddress } from "@/lib/xml/address"
import { libraryHref } from "@/lib/xml/library"

// Typeset at an address (Brendan, 2026-09-15): jurisdiction, kind, path, then
// the view. Every Work Typeset opens lives under here, with no vendor's serial
// number in the path; lib/xml/address.ts reads the path both ways.
//
//   /workspace/typeset/us/bill/119/hr/6644                      the bill, default view
//   /workspace/typeset/us/bill/119/hr/6644/xml                  its XML view; /git, /redline, /outline, /diff, /library, /fork
//   /workspace/typeset/us/bill/119/hr/6644@2026-06-25_enr/xml   a printing
//   /workspace/typeset/us/usc/t7/s1                             7 U.S.C. § 1
//   /workspace/typeset/us/pl/119/21                             a public law
//   /workspace/typeset/us/ny/bill/2025/s/1234/git               a New York bill
//   /workspace/typeset/us/ny/code/agm/s16?at=2024-01-01         a section as it stood on a date
//   /workspace/typeset/us/ny/const/art1/s1                      the constitution

type Params = Promise<{ path?: string[] }>
type Search = Promise<Record<string, string | string[] | undefined>>

async function read(params: Params) {
  const segments = ["us", ...((await params).path ?? [])]
  const parsed = addressOfTypesetPath(segments, VIEW_SLUGS)
  if (!parsed) return null
  const bill = parsed.address.kind === "bill" ? await billIdOfWork(parsed.address.workAddress).then((id) => (id ? getBill(id) : null)) : null
  return { ...parsed, bill }
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const found = await read(params).catch(() => null)
  if (!found) return { title: "Typeset" }
  const view = viewFromSlug(found.slug ?? undefined)
  if (found.bill && view) return typesetBillMetadata(found.bill, view)
  const at = (await searchParams).at
  return typesetStatuteMetadata(formatAddress(found.address.workAddress, found.address.expression), dateOfAt(typeof at === "string" ? at : null))
}

export default async function TypesetAddressPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const found = await read(params)
  if (!found) {
    if (!(await params).path?.length) redirect(libraryHref("us"))
    notFound()
  }
  const sp = await searchParams
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") query.set(k, v)
  const { address, slug, bill } = found

  if (bill) {
    const view = viewFromSlug(slug ?? undefined)
    if (!view) notFound()
    // An old slug (comp, versions, actions) opens its view at the view's own path.
    if (slug && slug !== viewSpec(view).slug) redirect(typesetHref(formatAddress(address.workAddress, address.expression), view, query))
    // The bill's Work: a portion below it (`…/6644/tI/s101`) opens the bill.
    const work = address.workAddress.split("/").slice(0, 6).join("/")
    return <TypesetBillRoute bill={bill} view={view} address={work} expression={address.expression} version={query.get("version") ?? undefined} />
  }
  // A statute has the reader alone; a stored bill with no row in "Bills" is drawn the same way.
  if (slug && slug !== "xml") notFound()
  return <TypesetStatuteRoute address={formatAddress(address.workAddress, address.expression)} at={dateOfAt(query.get("at"))} />
}
