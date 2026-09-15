import "server-only"

import { gunzipSync, gzipSync } from "node:zlib"

import { billWork, federalStage, printingStage } from "@/lib/xml/address"
import { docToHtml, docToJson } from "@/lib/xml/convert"
import { frontEndFor, textFrontEnd } from "@/lib/xml/frontends"
import type { ParseReport } from "@/lib/xml/ir"
import { uslmToDoc, type DocReport, type Fidelity } from "@/lib/xml/uslm-to-doc"
import { hasDatabase, one, q } from "@/lib/policy/db"
import { fetchUslmXml } from "@/lib/policy/bill-uslm"
import { getBill, getBillText } from "@/lib/policy/queries"
import { latestDocumentId } from "@/lib/typeset/document-store"
import type { Bill } from "@/lib/policy/types"

// A bill printing in the XML view (window 1, 2026-09-14): its USLM through
// the front end for its jurisdiction, into the reader's ProseMirror document,
// and that document drawn as HTML for the page to paint before any script
// runs. Beside lib/typeset/document.ts, which does the same for the Plate
// reader, and cached the same way: in memory per printing, and in
// typeset_documents once sql/010 has run.
//
// A printing with no XML behind it (every state bill tonight, federal
// printings before 2013) goes through the plain-text front end into the same
// schema, and the page says so.

/** Goes up when the front ends, uslmToDoc or the HTML converter change what they produce. */
export const XML_BUILDER = 1

/** A legislature's web page stored as the bill: California leginfo's hide-the-page style and frame-busting script (scripts/xml/sources/printings.mjs holds the same test). */
const CAPTURED_PAGE = /\/\*\s*Hide page by default\s*\*\/|window\.top\.location\.replace|<script\b/i

export type XmlTimings = { fetchMs: number; frontMs: number; docMs: number; htmlMs: number; totalMs: number }
export type XmlBytes = { source: number; json: number; html: number }

export type XmlDocument = {
  billId: number
  documentId: number | null
  version: string | null
  date: string | null
  /** The Work and Expression the document is, in the corpus's address. */
  work: string | null
  expression: string | null
  fidelity: Fidelity
  dialect: string
  sourceUrl: string | null
  /** The stored text is a web page captured in place of the printing, and is not drawn. */
  captured: boolean
  json: unknown
  html: string
  front: ParseReport | null
  report: DocReport
  timings: XmlTimings
  bytes: XmlBytes
  builtAt: string
}

const TTL_MS = 10 * 60 * 1000
const KEPT = 16
const kept = new Map<string, { document: XmlDocument; at: number }>()

function keep(key: string, document: XmlDocument) {
  kept.delete(key)
  kept.set(key, { document, at: Date.now() })
  if (kept.size > KEPT) kept.delete(kept.keys().next().value!)
}

const since = (t: number) => Math.round((performance.now() - t) * 10) / 10

/** Builds a printing's XML document from its source, ignoring every cache: what the parse tile runs. */
export async function buildXmlDocument(bill: Bill, version?: number): Promise<XmlDocument> {
  const started = performance.now()
  const text = await getBillText(bill.bill_id, version)
  let t = performance.now()
  const xml = text ? await fetchUslmXml(text.url) : null
  const fetchMs = since(t)

  t = performance.now()
  let fidelity: Fidelity = "plain-text"
  let captured = false
  let parsed
  if (xml) {
    parsed = frontEndFor(bill.state).parse({ kind: "xml", body: xml, url: text?.url, jurisdiction: bill.state })
    fidelity = "native-xml"
  } else {
    // A legislature's web page stored in place of the bill (California's leginfo captures) is not drawn as the bill; the source line says so.
    captured = CAPTURED_PAGE.test((text?.text ?? "").slice(0, 4000))
    const body = captured ? "" : (text?.text ?? "")
    try {
      parsed = frontEndFor(bill.state).parse({ kind: "text", body, url: text?.url, jurisdiction: bill.state })
    } catch {
      parsed = textFrontEnd.parse({ kind: "text", body, jurisdiction: bill.state })
    }
  }
  const frontMs = since(t)

  const work = billWork(bill)
  const date = text?.date ?? null
  const stage = text?.url ? federalStage(text.url) : null
  const expression = date ? `${date.slice(0, 10)}_${stage ?? printingStage(text?.version ?? text?.document_desc ?? "text")}` : null

  t = performance.now()
  const { doc, report } = uslmToDoc(parsed.doc, { dialect: parsed.report.dialect, identifier: work, expression, fidelity, title: bill.citation ?? null })
  const docMs = since(t)
  const json = docToJson(doc)

  t = performance.now()
  const html = docToHtml(doc)
  const htmlMs = since(t)

  const jsonText = JSON.stringify(json)
  return {
    billId: bill.bill_id,
    documentId: text?.document_id ?? null,
    version: text?.version ?? null,
    date,
    work,
    expression,
    fidelity,
    dialect: parsed.report.dialect,
    sourceUrl: text?.url ?? null,
    captured,
    json,
    html,
    front: parsed.report,
    report: report,
    timings: { fetchMs, frontMs, docMs, htmlMs, totalMs: since(started) },
    bytes: { source: Buffer.byteLength(xml ?? text?.text ?? ""), json: Buffer.byteLength(jsonText), html: Buffer.byteLength(html) },
    builtAt: new Date().toISOString(),
  }
}

/** The address a printing is stored under in the XML store, without building it: `version` is a document id. The same Work and Expression buildXmlDocument names. */
export async function printingAddress(bill: Bill, version?: number): Promise<{ work: string; expression: string } | null> {
  const text = await getBillText(bill.bill_id, version)
  const work = billWork(bill)
  const date = text?.date ?? null
  if (!work || !date) return null
  const stage = text?.url ? federalStage(text.url) : null
  return { work, expression: `${date.slice(0, 10)}_${stage ?? printingStage(text?.version ?? text?.document_desc ?? "text")}` }
}

/** A printing's XML document: `version` is a document id. Null when there is no such bill. */
export async function getXmlDocument(billId: number, version?: number, bill?: Bill): Promise<XmlDocument | null> {
  const record = bill ?? (await getBill(billId))
  if (!record) return null
  const key = `${record.bill_id}:${version ?? ""}`
  const cached = kept.get(key)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.document

  const documentId = version ?? (await latestDocumentId(record.bill_id))
  const stored = documentId == null ? null : await readStored(documentId)
  if (stored) {
    keep(key, stored)
    return stored
  }
  const document = await buildXmlDocument(record, version)
  keep(key, document)
  if (document.documentId != null) void writeStored(document)
  return document
}

// ------------------------------------------------------------------ store ---
// Beside the Slate columns in typeset_documents (sql/010, written, not run).
// Until the columns exist every read and write fails once, quietly, and the
// reader builds on read.

const SLICE = 600_000
let unavailable = false

type Meta = Omit<XmlDocument, "json" | "html">

async function readSlices(documentId: number, column: "pm_json_gz" | "pm_html_gz", bytes: number) {
  const parts: Buffer[] = []
  for (let start = 1; start <= bytes; start += SLICE) {
    const row = await one<{ part: string }>(`select encode(substring(${column} from $2 for $3), 'base64') as part from typeset_documents where document_id = $1`, [documentId, start, SLICE])
    if (!row) throw new Error("row vanished")
    parts.push(Buffer.from(row.part, "base64"))
  }
  return gunzipSync(Buffer.concat(parts)).toString("utf8")
}

async function readStored(documentId: number): Promise<XmlDocument | null> {
  if (unavailable || !hasDatabase()) return null
  try {
    const row = await one<{ pm_builder: number | null; j: number | null; h: number | null; meta: string | null }>(
      `select pm_builder, octet_length(pm_json_gz) as j, octet_length(pm_html_gz) as h, pm_report::text as meta from typeset_documents where document_id = $1`,
      [documentId]
    )
    if (!row || Number(row.pm_builder) !== XML_BUILDER || !row.j || !row.h || !row.meta) return null
    const meta = JSON.parse(row.meta) as Meta
    const [json, html] = await Promise.all([readSlices(documentId, "pm_json_gz", Number(row.j)), readSlices(documentId, "pm_html_gz", Number(row.h))])
    return { ...meta, json: JSON.parse(json), html }
  } catch (error) {
    unavailable = true
    console.warn("xml documents: store unavailable, building instead:", String((error as Error)?.message ?? error).slice(0, 160))
    return null
  }
}

/** Written onto the printing's existing row; a printing the Plate reader has not stored yet is kept in memory only. */
async function writeStored(document: XmlDocument): Promise<boolean> {
  if (unavailable || !hasDatabase() || document.documentId == null) return false
  try {
    const { json, html, ...meta } = document
    const gz = { pm_json_gz: gzipSync(JSON.stringify(json)), pm_html_gz: gzipSync(html) }
    const first = (b: Buffer) => b.subarray(0, SLICE).toString("base64")
    const rows = await q<{ document_id: number }>(
      `update typeset_documents set pm_builder = 0, pm_json_gz = decode($2, 'base64'), pm_html_gz = decode($3, 'base64'), pm_report = $4::jsonb, pm_json_bytes = $5, pm_html_bytes = $6
        where document_id = $1 returning document_id`,
      [document.documentId, first(gz.pm_json_gz), first(gz.pm_html_gz), JSON.stringify(meta), document.bytes.json, document.bytes.html]
    )
    if (!rows.length) return false
    for (const column of ["pm_json_gz", "pm_html_gz"] as const) {
      for (let start = SLICE; start < gz[column].length; start += SLICE) {
        await q(`update typeset_documents set ${column} = ${column} || decode($2, 'base64') where document_id = $1`, [document.documentId, gz[column].subarray(start, start + SLICE).toString("base64")])
      }
    }
    await q(`update typeset_documents set pm_builder = $2 where document_id = $1`, [document.documentId, XML_BUILDER])
    return true
  } catch (error) {
    unavailable = true
    console.warn("xml documents: store unavailable:", String((error as Error)?.message ?? error).slice(0, 160))
    return false
  }
}
