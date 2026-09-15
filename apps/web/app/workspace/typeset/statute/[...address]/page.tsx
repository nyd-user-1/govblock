import { redirect } from "next/navigation"

import { dateOfAt } from "@/components/workspace/typeset-statute-route"
import { workHref } from "@/lib/xml/library"

// /workspace/typeset/statute/<jurisdiction>/<code>/<section> (2026-09-15, the
// morning's statute URL): a statute lives at its address now,
// /workspace/typeset/us/ny/code/agm/s16, and this sends links made meanwhile
// there. The `code` segment was implied here unless the kind was one kept.

type Params = Promise<{ address: string[] }>
type Search = Promise<{ at?: string }>

const KINDS_KEPT = new Set(["usc", "const", "pl", "law"])

export default async function TypesetStatuteDoor({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [jurisdiction, next, ...rest] = (await params).address.map((p) => decodeURIComponent(p))
  const address = next && KINDS_KEPT.has(next) ? `/${[jurisdiction, next, ...rest].join("/")}` : `/${[jurisdiction, "code", next, ...rest].filter(Boolean).join("/")}`
  redirect(workHref(address, dateOfAt((await searchParams).at)))
}
