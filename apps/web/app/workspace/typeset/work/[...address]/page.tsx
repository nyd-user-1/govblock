import { redirect } from "next/navigation"

import { dateOfAt } from "@/components/workspace/typeset-statute-route"
import { workHref } from "@/lib/xml/library"

// /workspace/typeset/work/<address> (window 4, 2026-09-14): the address form
// before Typeset's URLs became addresses (2026-09-15). A bill's address goes
// to its XML view, a statute's to the reader, both at
// /workspace/typeset/us/…; links out in the site still come through here.

type Params = Promise<{ address: string[] }>
type Search = Promise<{ at?: string }>

export default async function TypesetWorkDoor({ params, searchParams }: { params: Params; searchParams: Search }) {
  const address = `/${(await params).address.map((p) => decodeURIComponent(p)).join("/")}`
  redirect(workHref(address, dateOfAt((await searchParams).at)))
}
