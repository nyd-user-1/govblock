import { type Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetWorkspacePage } from "@/components/workspace/typeset-workspace-2"
import { LEGACY_ITEM_VIEW, typesetHref } from "@/lib/typeset/views"

// /workspace/typeset — the Typeset editor (Brendan, 2026-09-07; 2026-09-11:
// the editor that grew up at /workspace/typeset-2 is the one, and lives
// here now). The providers are the ones the old /typeset layout wrapped its page in:
// TypesetHistoryProvider reads useSearchParams(), so it sits under Suspense
// with the page's skeleton as the fallback.
export const metadata: Metadata = { title: "Typeset", description: "Typography for markdown you don't control." }

// A bill in the query is the old address (2026-09-12): it lives at
// /workspace/typeset/bill/{id}[/{view}] now, and the old `item` names its view.
export default async function WorkspaceTypesetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const bill = typeof sp.bill === "string" ? sp.bill : ""
  if (/^\d+$/.test(bill)) {
    const item = typeof sp.item === "string" ? sp.item : ""
    const keep: Record<string, string | undefined> = { version: typeof sp.version === "string" ? sp.version : undefined }
    redirect(typesetHref(bill, LEGACY_ITEM_VIEW[item] ?? "typeset", keep))
  }
  return (
    <LocksProvider>
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
          <TypesetWorkspacePage />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
