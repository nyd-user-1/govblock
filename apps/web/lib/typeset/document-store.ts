import "server-only"

import { gunzipSync, gzipSync } from "node:zlib"

import { hasDatabase, one, q } from "@/lib/policy/db"

// typeset_documents (sql/004_typeset_documents.sql): a built Typeset document
// per bill version, stored gzipped (typeset-perf, 2026-09-13).
//
// The site reads Aurora over the RDS Data API, which refuses a result over
// 1 MB, so each column is read in base64 slices under the cap, and written the
// same way: the row is inserted unfinished (builder 0) and marked with the
// builder's version only once every slice is in, so a reader never takes a
// half-written row. A missing table, a missing database or any failure reads as
// "not stored", and the caller builds the document instead.

/** Goes up when the HTML builder, the deserializer or the snapshot changes; older rows are rebuilt on read. */
export const TYPESET_BUILDER = 1

export type StoredDocument = {
  documentId: number
  billId: number
  version: string | null
  date: string | null
  html: string
  value: unknown
  snapshot: string
}

const SLICE = 600_000 // raw bytes a read or write carries; base64 of it stays under the 1 MB cap
const COLUMNS = ["html_gz", "value_gz", "snapshot_gz"] as const
type Column = (typeof COLUMNS)[number]

let warned = false
function unavailable(error: unknown) {
  if (warned) return
  warned = true
  console.warn("typeset documents: store unavailable, building instead:", String((error as Error)?.message ?? error).slice(0, 200))
}

async function readColumn(documentId: number, column: Column, bytes: number): Promise<Buffer> {
  const parts: Buffer[] = []
  for (let start = 1; start <= bytes; start += SLICE) {
    const row = await one<{ part: string }>(`select encode(substring(${column} from $2 for $3), 'base64') as part from typeset_documents where document_id = $1`, [documentId, start, SLICE])
    if (!row) throw new Error(`typeset document ${documentId} vanished while reading`)
    parts.push(Buffer.from(row.part, "base64"))
  }
  return Buffer.concat(parts)
}

/** The stored document for a document id, or null when there is none built by this builder. */
export async function readStoredDocument(documentId: number): Promise<StoredDocument | null> {
  if (!hasDatabase()) return null
  try {
    const row = await one<{ bill_id: number; version: string | null; doc_date: string | null; builder: number; html_gz: number; value_gz: number; snapshot_gz: number }>(
      `select bill_id, version, doc_date, builder,
              octet_length(html_gz) as html_gz, octet_length(value_gz) as value_gz, octet_length(snapshot_gz) as snapshot_gz
         from typeset_documents where document_id = $1`,
      [documentId]
    )
    if (!row || Number(row.builder) !== TYPESET_BUILDER) return null
    const [html, value, snapshot] = await Promise.all(COLUMNS.map((column) => readColumn(documentId, column, Number(row[column]))))
    return {
      documentId,
      billId: Number(row.bill_id),
      version: row.version,
      date: row.doc_date,
      html: gunzipSync(html).toString("utf8"),
      value: JSON.parse(gunzipSync(value).toString("utf8")),
      snapshot: gunzipSync(snapshot).toString("utf8"),
    }
  } catch (error) {
    unavailable(error)
    return null
  }
}

/** Stores a built document; failures are logged and swallowed, since the reader already has the document. */
export async function writeStoredDocument(document: StoredDocument): Promise<boolean> {
  if (!hasDatabase()) return false
  try {
    const html = Buffer.from(document.html, "utf8")
    const value = Buffer.from(JSON.stringify(document.value), "utf8")
    const snapshot = Buffer.from(document.snapshot, "utf8")
    const gz: Record<Column, Buffer> = { html_gz: gzipSync(html), value_gz: gzipSync(value), snapshot_gz: gzipSync(snapshot) }
    const first = (column: Column) => gz[column].subarray(0, SLICE).toString("base64")
    await q(
      `insert into typeset_documents (document_id, bill_id, version, doc_date, builder, html_gz, value_gz, snapshot_gz, html_bytes, value_bytes, snapshot_bytes, built_at)
       values ($1, $2, $3, $4, 0, decode($5, 'base64'), decode($6, 'base64'), decode($7, 'base64'), $8, $9, $10, now())
       on conflict (document_id) do update set
         bill_id = excluded.bill_id, version = excluded.version, doc_date = excluded.doc_date, builder = 0,
         html_gz = excluded.html_gz, value_gz = excluded.value_gz, snapshot_gz = excluded.snapshot_gz,
         html_bytes = excluded.html_bytes, value_bytes = excluded.value_bytes, snapshot_bytes = excluded.snapshot_bytes,
         built_at = now()`,
      [document.documentId, document.billId, document.version, document.date, first("html_gz"), first("value_gz"), first("snapshot_gz"), html.length, value.length, snapshot.length]
    )
    for (const column of COLUMNS) {
      for (let start = SLICE; start < gz[column].length; start += SLICE) {
        await q(`update typeset_documents set ${column} = ${column} || decode($2, 'base64') where document_id = $1`, [document.documentId, gz[column].subarray(start, start + SLICE).toString("base64")])
      }
    }
    await q(`update typeset_documents set builder = $2 where document_id = $1`, [document.documentId, TYPESET_BUILDER])
    return true
  } catch (error) {
    unavailable(error)
    return false
  }
}

/** The newest document with text for a bill: the version Typeset opens when none is named. */
export async function latestDocumentId(billId: number): Promise<number | null> {
  if (!hasDatabase()) return null
  try {
    const row = await one<{ document_id: number | null }>(`select max(document_id) as document_id from "BillTexts" where bill_id = $1 and text is not null`, [billId])
    return row?.document_id == null ? null : Number(row.document_id)
  } catch (error) {
    unavailable(error)
    return null
  }
}
