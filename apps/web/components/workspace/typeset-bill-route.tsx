import "server-only"

import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { ScopeMark } from "@/components/scope-mark"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetWorkspacePage, type XmlFirstPaint } from "@/components/workspace/typeset-workspace-2"
import { entitled } from "@/lib/entitlements"
import { readerOf } from "@/lib/entitlements-server"
import { getTypesetDocument } from "@/lib/typeset/document"
import { getXmlDocument, storedPrinting } from "@/lib/typeset/xml-document"
import { getExpressionDocument } from "@/lib/typeset/expression-document"
import { expressionOf } from "@/lib/policy/expressions"
import { fmtBill } from "@/lib/format"
import { latestSession } from "@/lib/policy/db-queries"
import type { Bill } from "@/lib/policy/types"
import { viewSpec, type TypesetView } from "@/lib/typeset/views"

// A bill in Typeset (Brendan, 2026-09-12), one route per view: the editor,
// the outline, Git, the diff, the XML view, the Library, the fork. Drawn at
// the bill's address since 2026-09-15 (app/workspace/typeset/us), and at the
// old /workspace/typeset/bill/<id> only for a bill with no address. The bill
// is read once so the page knows its jurisdiction before the browser does;
// everything else the views need they fetch themselves.

export function typesetBillMetadata(bill: Bill, view: TypesetView): Metadata {
  return { title: `${fmtBill(bill.bill_number, bill.state)} · ${viewSpec(view).label}`, description: bill.title }
}

export async function TypesetBillRoute({ bill, view, address, expression, version }: { bill: Bill; view: TypesetView; /** The bill's Work, when it has one. */ address: string | null; /** A printing the URL named (`…/6644@2026-06-25_enr/xml`): the XML view opens it. */ expression: string | null; /** A document id from the old `?version=`. */ version: string | undefined }) {
  const current = await latestSession(bill.state).catch(() => null)
  // The page as the server drew it (Brendan, 2026-09-13): on the editor views
  // the reader sees the bill at first paint, in the editor's own classes, and
  // the editor takes over once it has the text. The snapshot is a string built
  // once with the document and cached (lib/typeset/document.ts); as a string
  // it crosses into the client tree as markup, not as a tree of elements. Only
  // for a reader who may open the bill: a gated bill's text never enters the
  // page. Any failure to build it leaves the skeleton, never the page.
  let snapshot: ReactNode
  if (view === "typeset" || view === "outline") {
    const reader = await readerOf()
    if (entitled(reader, { state: bill.state, session: bill.session_id, current, entity: "bills" }) === "open") {
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
  // 2026-09-14), built from its USLM and kept like the snapshot above. A
  // printing in the XML store is drawn from its stored Expression (2026-09-15):
  // that is the document the reader's copy is made from when they type, so
  // the two are one text. A printing not stored is built from its source and
  // cannot be copied.
  let xml: XmlFirstPaint | undefined
  if (view === "xml") {
    const reader = await readerOf()
    if (entitled(reader, { state: bill.state, session: bill.session_id, current, entity: "bills" }) === "open") {
      const row = address && expression ? await expressionOf(address, expression).catch(() => null) : await storedPrinting(bill, Number(version) || undefined).catch(() => null)
      const stored = row ? await getExpressionDocument(row).catch(() => null) : null
      if (stored) {
        xml = { snapshot: stored.html, meta: { ...stored.meta, documentId: null }, jsonUrl: `/api/typeset/work?address=${encodeURIComponent(stored.address)}`, address: stored.address }
      } else {
        const doc = await getXmlDocument(bill.bill_id, Number(version) || undefined, bill).catch((error) => {
          console.error("xml view: could not build", bill.bill_id, error)
          return null
        })
        if (doc) xml = { snapshot: doc.html, meta: { documentId: doc.documentId, version: doc.version, date: doc.date, work: doc.work, expression: doc.expression, fidelity: doc.fidelity, dialect: doc.dialect, sourceUrl: doc.sourceUrl, captured: doc.captured }, jsonUrl: null, address: null }
      }
    }
  }
  return (
    <LocksProvider>
      <ScopeMark state={bill.state} session={bill.session_id ? Number(bill.session_id) : null} current={current} entity="bills" />
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
          <TypesetWorkspacePage route={{ billId: bill.bill_id, address, state: bill.state, session: bill.session_id ? Number(bill.session_id) : null, view }} snapshot={snapshot} xml={xml} />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
