import { type Metadata } from "next"
import { redirect } from "next/navigation"

import { DEFAULT_BILL, LEGACY_ITEM_VIEW, typesetHref } from "@/lib/typeset/views"

// /workspace/typeset — the Typeset editor (Brendan, 2026-09-07; 2026-09-11:
// the editor that grew up at /workspace/typeset-2 is the one, and lives
// here now).
export const metadata: Metadata = { title: "Typeset", description: "Typography for markdown you don't control." }

// A bill in the query is the old address (2026-09-12): it lives at
// /workspace/typeset/bill/{id}[/{view}] now, and the old `item` names its view.
// No bill at all opens H.R. 6644 (Brendan, 2026-09-13) — until then the bare
// page drew Plate's own playground text, which nobody came here to read.
export default async function WorkspaceTypesetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const bill = typeof sp.bill === "string" && /^\d+$/.test(sp.bill) ? sp.bill : DEFAULT_BILL
  const item = typeof sp.item === "string" ? sp.item : ""
  const keep: Record<string, string | undefined> = { version: typeof sp.version === "string" ? sp.version : undefined }
  redirect(typesetHref(bill, LEGACY_ITEM_VIEW[item] ?? "typeset", keep))
}
