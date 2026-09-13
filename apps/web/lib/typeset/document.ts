import "server-only"

import { parseHTML } from "linkedom"
import { createSlateEditor, type Value } from "platejs"
import { createStaticEditor, serializeHtml } from "platejs/static"

import { BaseAlignKit } from "@/components/plate/editor/plugins/align-base-kit"
import { BaseBasicBlocksKit } from "@/components/plate/editor/plugins/basic-blocks-base-kit"
import { BaseBasicMarksKit } from "@/components/plate/editor/plugins/basic-marks-base-kit"
import { BaseFontKit } from "@/components/plate/editor/plugins/font-base-kit"
import { BaseLineHeightKit } from "@/components/plate/editor/plugins/line-height-base-kit"
import { BaseLinkKit } from "@/components/plate/editor/plugins/link-base-kit"
import { BaseListKit } from "@/components/plate/editor/plugins/list-base-kit"
import { BaseTableKit } from "@/components/plate/editor/plugins/table-base-kit"
import { EditorStatic } from "@/components/plate/ui/editor-static"
import { billCitation } from "@/lib/policy/congress"
import { esc } from "@/lib/policy/bill-html"
import { fetchUslm, plainTextHtml } from "@/lib/policy/bill-uslm"
import { getBill, getBillText } from "@/lib/policy/queries"
import { latestDocumentId, readStoredDocument, writeStoredDocument } from "@/lib/typeset/document-store"
import type { Bill } from "@/lib/policy/types"

// A bill's page in Typeset, built once on the server (typeset-perf,
// 2026-09-13): the HTML the editor used to fetch and parse on every open, and
// the Slate value that HTML reads into, so a page can render the document
// before any script runs and the editor can start from the value.
//
// The article is built from the document's USLM XML (2026-09-10), because that
// is where a bill's structure lives: <section>, <enum>, <header> and the levels
// beneath them become headings and paragraphs the editor can work with.
// Documents with no XML behind them fall back to reading the levels out of the
// stored plain text.
//
// The gate is the caller's: this reads the record, it does not decide who may.

export type TypesetDocument = {
  html: string
  value: Value
  /** The value drawn by the editor's static components, for a page to show before the editor mounts. */
  snapshot: string
  documentId: number | null
  version: string | null
  date: string | null
}

/**
 * The static side of BillKit: the plugins a bill's HTML reads through and the
 * static components that draw it, with nothing that imports React hooks, so a
 * server component can render a document with `createStaticEditor`.
 */
export const billStaticKit = [
  ...BaseBasicBlocksKit,
  ...BaseTableKit,
  ...BaseLinkKit,
  ...BaseBasicMarksKit,
  ...BaseFontKit,
  ...BaseListKit,
  ...BaseAlignKit,
  ...BaseLineHeightKit,
]

/**
 * HTML into Slate the way the browser's editor reads it. Plate's deserializer
 * needs `Node` and `DOMParser`; they exist only for this synchronous call, so
 * nothing else in the server process sees a DOM.
 */
function deserialize(html: string): Value {
  const dom = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  const scope = globalThis as unknown as Record<string, unknown>
  const saved = { Node: scope.Node, DOMParser: scope.DOMParser }
  scope.Node = dom.Node
  scope.DOMParser = dom.DOMParser
  try {
    const editor = createSlateEditor({ plugins: billStaticKit })
    return editor.api.html.deserialize({ element: dom.document.body as unknown as HTMLElement }) as Value
  } finally {
    scope.Node = saved.Node
    scope.DOMParser = saved.DOMParser
  }
}

/**
 * The document as the editor draws it, as markup. 1.3–1.8 s for H.R. 6644 in
 * development (typeset-perf, 2026-09-13), so it is built with the document and
 * kept, never rendered per request. Data attributes are stripped: the snapshot
 * is only looked at, and they made it 1.5 MB instead of 1.1 MB.
 */
async function renderSnapshot(value: Value): Promise<string> {
  const editor = createStaticEditor({ plugins: billStaticKit, value })
  const html = await serializeHtml(editor, { editorComponent: EditorStatic, props: { variant: "default" }, stripDataAttributes: true })
  // The root keeps `data-slate-editor` through the strip, and code that looks
  // for the editor before it hydrates (the export button's capture, the
  // inspector) would find the snapshot. It is marked as the snapshot instead.
  return html.replace(/^(<[^>]*?)\sdata-slate-editor(="[^"]*")?/, "$1 data-typeset-snapshot")
}

// A bill version's published text does not change. A document is read from
// typeset_documents when it has been stored and built only when it has not;
// either way it is kept here per bill and version for ten minutes, sixteen at
// a time. A bill whose text has not been fetched yet is neither stored nor
// kept, so its text shows once it has.
const DOCUMENT_TTL_MS = 10 * 60 * 1000
const DOCUMENTS_KEPT = 16
const documents = new Map<string, { document: TypesetDocument; at: number }>()

function keep(key: string, document: TypesetDocument) {
  documents.delete(key)
  documents.set(key, { document, at: Date.now() })
  if (documents.size > DOCUMENTS_KEPT) documents.delete(documents.keys().next().value!)
}

async function buildDocument(bill: Bill, version?: number): Promise<TypesetDocument> {
  const text = await getBillText(bill.bill_id, version)
  const shown = text ? `${text.document_desc ?? text.version ?? ""}${text.date ? ` (${text.date})` : ""}`.trim() : ""
  const uslm = text ? await fetchUslm(text.url) : null
  // The document names itself — "H. R. 5366", the way the GPO sets it — which
  // beats the record's own key ("HB5366") at the top of a page a reader reads.
  const heading = uslm?.title ?? billCitation(bill.bill_number, bill.state)
  const head = `<h1>${esc(heading)}</h1><p><em>${esc(bill.title)}</em></p>${shown ? `<p><strong>Shown here:</strong> ${esc(shown)}</p>` : ""}`
  const body = uslm ? uslm.html : text ? plainTextHtml(text.text) : "<p>The text of this bill has not been fetched yet.</p>"
  const html = `${head}${body}`
  const value = deserialize(html)
  return {
    html,
    value,
    snapshot: await renderSnapshot(value),
    documentId: text?.document_id ?? null,
    version: text?.version ?? null,
    date: text?.date ?? null,
  }
}

const store = (bill: Bill, document: TypesetDocument) =>
  document.documentId == null
    ? Promise.resolve(false)
    : writeStoredDocument({ ...document, documentId: document.documentId, billId: bill.bill_id })

/** A bill's Typeset document: `version` is a document id; null when there is no such bill. */
export async function getTypesetDocument(billId: number, version?: number, bill?: Bill): Promise<TypesetDocument | null> {
  const record = bill ?? (await getBill(billId))
  if (!record) return null
  const key = `${record.bill_id}:${version ?? ""}`
  const cached = documents.get(key)
  if (cached && Date.now() - cached.at < DOCUMENT_TTL_MS) return cached.document

  const documentId = version ?? (await latestDocumentId(record.bill_id))
  const stored = documentId == null ? null : await readStoredDocument(documentId)
  if (stored && stored.billId === record.bill_id) {
    const document: TypesetDocument = { html: stored.html, value: stored.value as Value, snapshot: stored.snapshot, documentId: stored.documentId, version: stored.version, date: stored.date }
    keep(key, document)
    return document
  }

  const document = await buildDocument(record, version)
  if (document.documentId != null) {
    keep(key, document)
    // Written behind the reader's back: a failed write only means the next
    // reader builds it again.
    void store(record, document)
  }
  return document
}

/** Builds a bill version's document and waits for it to be stored, whatever is stored already: for the backfill. */
export async function storeTypesetDocument(billId: number, version?: number): Promise<{ documentId: number | null; stored: boolean; htmlBytes: number; valueBytes: number; snapshotBytes: number } | null> {
  const record = await getBill(billId)
  if (!record) return null
  const document = await buildDocument(record, version)
  keep(`${record.bill_id}:${version ?? ""}`, document)
  return {
    documentId: document.documentId,
    stored: await store(record, document),
    htmlBytes: Buffer.byteLength(document.html),
    valueBytes: Buffer.byteLength(JSON.stringify(document.value)),
    snapshotBytes: Buffer.byteLength(document.snapshot),
  }
}
