import "server-only"

import type { Ask } from "@/lib/entitlements"
import { expressionAt, expressionOf, expressionsOf, readUslm, type ExpressionRow } from "@/lib/policy/expressions"
import { parseAddress } from "@/lib/xml/address"
import { docToHtml, docToJson } from "@/lib/xml/convert"
import { parseXml } from "@/lib/xml/ir"
import { uslmToDoc, type DocReport, type Fidelity } from "@/lib/xml/uslm-to-doc"

// A stored Expression in the XML view (window 4, 2026-09-14): the USLM the
// pipeline wrote to S3 (lib/policy/expressions.ts), read back into the
// reader's ProseMirror document and drawn as HTML for the first paint. The
// same shape lib/typeset/xml-document.ts gives a bill printing, but keyed by
// the address (docs/xml/schema.md), so a statute section, which has no bill
// row, loads the same way:
//
//   /us-ny/code/agm/s3                   the section's latest Expression
//   /us-ny/code/agm/s3?at=2024-01-01     the one in force on that date
//   /us/bill/119/hr/6644@2025-12-11_ih   that printing
//   /us/usc/t10/s130i/a/1                the section, opened at (a)(1)
//
// The stored document went through its jurisdiction's front end when it was
// built, so it is USLM already and goes straight to uslmToDoc.

/** Goes up when uslmToDoc or the HTML converter change what they produce. */
export const EXPRESSION_BUILDER = 1

export type ExpressionLine = { expression: string; date: string; unit: string; coverage: number | null }

export type ExpressionMeta = {
  documentId: null
  version: string | null
  date: string | null
  work: string
  expression: string
  fidelity: Fidelity
  dialect: string
  sourceUrl: string | null
}

export type ExpressionDocument = {
  /** work@expression */
  address: string
  work: string
  expression: string
  label: string | null
  kind: string
  jurisdiction: string
  session: string | null
  coverage: number | null
  /** The portion the address named below the Work ("/us/usc/t10/s130i/a/1"), for the reader to open at. */
  portion: string | null
  /** The Work's DocHistory, oldest first. */
  history: ExpressionLine[]
  meta: ExpressionMeta
  json: unknown
  html: string
  report: DocReport
  timings: { readMs: number; parseMs: number; docMs: number; htmlMs: number; totalMs: number }
  bytes: { gz: number; xml: number; json: number; html: number }
  builtAt: string
}

/** The fewest path segments a Work has under its kind: a bill is session/type/number, a section is code/section. */
const WORK_DEPTH: Record<string, number> = { bill: 3 }

/**
 * The stored row an address names. A portion below the Work is tried a segment
 * shorter at a time until a Work answers; `at` picks the Expression in force
 * on a date when the address names none.
 */
export async function findExpression(address: string, at?: string | null): Promise<{ row: ExpressionRow; portion: string | null } | null> {
  const parsed = parseAddress(address)
  if (!parsed) return null
  const segments = parsed.work.split("/").filter(Boolean)
  const floor = WORK_DEPTH[parsed.kind] ?? 2
  for (let n = segments.length; n >= floor && n > 0; n--) {
    const work = `/${parsed.jurisdiction}/${parsed.kind}/${segments.slice(0, n).join("/")}`
    const row = parsed.expression ? await expressionOf(work, parsed.expression) : await expressionAt(work, at ?? null)
    if (row) return { row, portion: n < segments.length ? parsed.workAddress : null }
  }
  return null
}

/** "us-ny" → "NY"; "us" → "US". */
export const stateOfJurisdiction = (jurisdiction: string) => (jurisdiction === "us" ? "US" : jurisdiction.replace(/^us-/, "").toUpperCase())

/** The year a stored session segment began: Congress 119 → 2025; "2025s1" → 2025. */
export function sessionYear(jurisdiction: string, session: string | null): number | null {
  const n = Number(String(session ?? "").replace(/s.*$/, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  return jurisdiction === "us" && n < 1000 ? 1789 + (n - 1) * 2 : n
}

/** What a reader must be entitled to: a printing is a bill's, a section is the laws'. */
export function askOf(row: Pick<ExpressionRow, "jurisdiction" | "kind" | "session">): Ask {
  const state = stateOfJurisdiction(row.jurisdiction)
  return row.kind === "bill" ? { state, session: sessionYear(row.jurisdiction, row.session), entity: "bills" } : { state, entity: "laws" }
}

const TTL_MS = 30 * 60 * 1000
const KEPT = 16
const kept = new Map<string, { document: ExpressionDocument; at: number }>()

const since = (t: number) => Math.round((performance.now() - t) * 10) / 10

/** Builds the document for a stored row, ignoring the cache. */
export async function buildExpressionDocument(row: ExpressionRow, portion: string | null = null): Promise<ExpressionDocument> {
  const started = performance.now()
  const [xml, rows] = await Promise.all([readUslm(row), expressionsOf(row.work)])
  const readMs = since(started)

  let t = performance.now()
  const ir = parseXml(xml)
  const parseMs = since(t)

  t = performance.now()
  const fidelity = row.fidelity as Fidelity
  const dialect = row.dialect ?? "uslm"
  const { doc, report } = uslmToDoc(ir, { dialect, identifier: row.work, expression: row.expression, fidelity, title: row.label })
  const docMs = since(t)
  const json = docToJson(doc)

  t = performance.now()
  const html = docToHtml(doc)
  const htmlMs = since(t)

  return {
    address: `${row.work}@${row.expression}`,
    work: row.work,
    expression: row.expression,
    label: row.label,
    kind: row.kind,
    jurisdiction: row.jurisdiction,
    session: row.session,
    coverage: row.coverage === null ? null : Number(row.coverage),
    portion,
    history: rows.map((r) => ({ expression: r.expression, date: r.expression_date, unit: r.unit, coverage: r.coverage === null ? null : Number(r.coverage) })),
    meta: { documentId: null, version: row.unit || null, date: row.expression_date, work: row.work, expression: row.expression, fidelity, dialect, sourceUrl: row.source_url },
    json,
    html,
    report,
    timings: { readMs, parseMs, docMs, htmlMs, totalMs: since(started) },
    bytes: { gz: Number(row.gz_bytes), xml: Buffer.byteLength(xml), json: Buffer.byteLength(JSON.stringify(json)), html: Buffer.byteLength(html) },
    builtAt: new Date().toISOString(),
  }
}

/** The document for a stored row: a stored Expression never changes, so it is kept by its address. */
export async function getExpressionDocument(row: ExpressionRow, portion: string | null = null): Promise<ExpressionDocument> {
  const key = `${row.work}@${row.expression}:${row.builder}`
  const cached = kept.get(key)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.document.portion === portion ? cached.document : { ...cached.document, portion }
  const document = await buildExpressionDocument(row, portion)
  kept.delete(key)
  kept.set(key, { document, at: Date.now() })
  if (kept.size > KEPT) kept.delete(kept.keys().next().value!)
  return document
}
