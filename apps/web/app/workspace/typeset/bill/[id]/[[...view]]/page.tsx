import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { ScopeMark } from "@/components/scope-mark"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetWorkspacePage, type XmlFirstPaint } from "@/components/workspace/typeset-workspace-2"
import { entitled } from "@/lib/entitlements"
import { readerOf } from "@/lib/entitlements-server"
import { getTypesetDocument } from "@/lib/typeset/document"
import { getXmlDocument } from "@/lib/typeset/xml-document"
import { fmtBill } from "@/lib/format"
import { latestSession } from "@/lib/policy/db-queries"
import { getBill } from "@/lib/policy/queries"
import { typesetHref, viewFromSlug, viewSpec } from "@/lib/typeset/views"

// /workspace/typeset/bill/{id}[/{view}] (Brendan, 2026-09-12): a bill in
// Typeset, one route per view — the editor, the outline, Git, the diff, the
// activity, and Git's versions and fork. The bill is read once here so the
// page knows its jurisdiction before the browser does; everything else the
// views need they fetch themselves.

type Params = Promise<{ id: string; view?: string[] }>
type Search = Promise<{ version?: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, view } = await params
  const key = viewFromSlug(view?.[0])
  const bill = /^\d+$/.test(id) ? await getBill(Number(id)) : null
  if (!bill || !key) return { title: "Typeset" }
  const label = viewSpec(key).label
  return { title: `${fmtBill(bill.bill_number, bill.state)} · ${label}`, description: bill.title }
}

export default async function TypesetBillPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id, view } = await params
  const key = viewFromSlug(view?.[0])
  if (!key || (view?.length ?? 0) > 1 || !/^\d+$/.test(id)) notFound()
  // A slug the routes used to have (comp, versions, actions) opens its view at the view's own address.
  if (view?.[0] && view[0] !== viewSpec(key).slug) redirect(typesetHref(Number(id), key))
  const bill = await getBill(Number(id))
  if (!bill) notFound()
  const current = await latestSession(bill.state).catch(() => null)
  // The page as the server drew it (Brendan, 2026-09-13): on the editor views
  // the reader sees the bill at first paint, in the editor's own classes, and
  // the editor takes over once it has the text. The snapshot is a string built
  // once with the document and cached (lib/typeset/document.ts); as a string
  // it crosses into the client tree as markup, not as a tree of elements. Only
  // for a reader who may open the bill: a gated bill's text never enters the
  // page. Any failure to build it leaves the skeleton, never the page.
  let snapshot: ReactNode
  if (key === "typeset" || key === "outline") {
    const reader = await readerOf()
    if (entitled(reader, { state: bill.state, session: bill.session_id, current, entity: "bills" }) === "open") {
      const { version } = await searchParams
      const doc = await getTypesetDocument(bill.bill_id, Number(version) || undefined, bill).catch(() => null)
      if (doc?.snapshot) {
        snapshot = (
          <div className="flex h-full min-h-0 flex-col">
            <div aria-hidden className="h-10 shrink-0 border-b border-b-border" />
            <div className="relative min-h-0 flex-1 overflow-y-auto" dangerouslySetInnerHTML={{ __html: doc.snapshot }} />
          </div>
        )
      }
    }
  }
  // The XML view paints the printing as the reader's schema draws it (window 1,
  // 2026-09-14), built from its USLM and kept like the snapshot above.
  let xml: XmlFirstPaint | undefined
  if (key === "xml") {
    const reader = await readerOf()
    if (entitled(reader, { state: bill.state, session: bill.session_id, current, entity: "bills" }) === "open") {
      const { version } = await searchParams
      const doc = await getXmlDocument(bill.bill_id, Number(version) || undefined, bill).catch((error) => {
        console.error("xml view: could not build", bill.bill_id, error)
        return null
      })
      if (doc) xml = { snapshot: doc.html, meta: { documentId: doc.documentId, version: doc.version, date: doc.date, work: doc.work, expression: doc.expression, fidelity: doc.fidelity, dialect: doc.dialect, sourceUrl: doc.sourceUrl } }
    }
  }
  return (
    <LocksProvider>
      <ScopeMark state={bill.state} session={bill.session_id ? Number(bill.session_id) : null} current={current} entity="bills" />
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
          <TypesetWorkspacePage route={{ billId: bill.bill_id, state: bill.state, session: bill.session_id ? Number(bill.session_id) : null, view: key }} snapshot={snapshot} xml={xml} />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
