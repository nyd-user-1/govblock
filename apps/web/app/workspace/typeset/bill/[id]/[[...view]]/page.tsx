import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetWorkspacePage } from "@/components/workspace/typeset-workspace-2"
import { fmtBill } from "@/lib/format"
import { getBill } from "@/lib/policy/queries"
import { viewFromSlug, viewSpec } from "@/lib/typeset/views"

// /workspace/typeset/bill/{id}[/{view}] (Brendan, 2026-09-12): a bill in
// Typeset, one route per view — the editor, the outline, Git, the diff, the
// activity, and Git's versions and fork. The bill is read once here so the
// page knows its jurisdiction before the browser does; everything else the
// views need they fetch themselves.

type Params = Promise<{ id: string; view?: string[] }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, view } = await params
  const key = viewFromSlug(view?.[0])
  const bill = /^\d+$/.test(id) ? await getBill(Number(id)) : null
  if (!bill || !key) return { title: "Typeset" }
  const label = viewSpec(key).label
  return { title: `${fmtBill(bill.bill_number, bill.state)} · ${label}`, description: bill.title }
}

export default async function TypesetBillPage({ params }: { params: Params }) {
  const { id, view } = await params
  const key = viewFromSlug(view?.[0])
  if (!key || (view?.length ?? 0) > 1 || !/^\d+$/.test(id)) notFound()
  const bill = await getBill(Number(id))
  if (!bill) notFound()
  return (
    <LocksProvider>
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
          <TypesetWorkspacePage route={{ billId: bill.bill_id, state: bill.state, session: bill.session_id ? Number(bill.session_id) : null, view: key }} />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
