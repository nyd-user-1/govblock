import "server-only"

import { gunzipSync, gzipSync } from "node:zlib"

import { one, q } from "@/lib/policy/db"
import { docToJson, docToText } from "@/lib/xml/convert"
import { xmlSchema } from "@/lib/xml/schema"
import type { Node as PmNode } from "@tiptap/pm/model"

// A commit's document (window 5, 2026-09-14): the fork's Expression at that
// commit, as the ProseMirror JSON of the reader's USLM schema, gzipped into
// "Commits".doc_gz (sql/011_forks_work.sql). The Data API moves about a
// megabyte a call, so a large document goes in and comes out in slices.

/** The schema version a commit's JSON is written against (lib/xml/schema.ts v1). */
export const DOC_SCHEMA = 1

const SLICE = 600_000

/** A document from JSON, checked against the schema; null when it is not one. */
export function readDocJson(json: unknown): PmNode | null {
  try {
    const doc = xmlSchema.nodeFromJSON(json as Record<string, unknown>)
    doc.check()
    return doc.type.name === "doc" ? doc : null
  } catch {
    return null
  }
}

/** What a commit stores for a document: its plain text for the readers that read `text`, and the JSON gzipped. */
export function commitPayload(doc: PmNode) {
  const json = JSON.stringify(docToJson(doc))
  return { text: docToText(doc), gz: gzipSync(json), bytes: Buffer.byteLength(json) }
}

/** The first slice goes in with the row; the rest are appended. */
export const firstSlice = (gz: Buffer) => gz.subarray(0, SLICE).toString("base64")

export async function appendSlices(commitId: number, gz: Buffer) {
  for (let start = SLICE; start < gz.length; start += SLICE) {
    await q(`update "Commits" set doc_gz = doc_gz || decode($2, 'base64') where id = $1`, [commitId, gz.subarray(start, start + SLICE).toString("base64")])
  }
}

/** A commit's document as JSON, or null when the commit holds only text. */
export async function readCommitDoc(commitId: number): Promise<unknown | null> {
  const row = await one<{ gz: number | null }>(`select octet_length(doc_gz) as gz from "Commits" where id = $1`, [commitId])
  const size = Number(row?.gz ?? 0)
  if (!size) return null
  const parts: Buffer[] = []
  for (let start = 1; start <= size; start += SLICE) {
    // The Data API sends integers as bigint, and substring over bytea takes int.
    const part = await one<{ part: string }>(`select encode(substring(doc_gz from $2::int for $3::int), 'base64') as part from "Commits" where id = $1`, [commitId, start, SLICE])
    if (!part) return null
    parts.push(Buffer.from(part.part, "base64"))
  }
  return JSON.parse(gunzipSync(Buffer.concat(parts)).toString("utf8"))
}

// A fork's working document (2026-09-15, sql/027_fork_drafts.sql): the text
// between commits, overwritten as the reader types, the way Google Docs saves.
// The browser sends it gzipped; the server checks it against the schema and
// keeps the bytes it was sent.

/** Writes the draft's gzipped JSON over the fork's last one. Null when the bytes are not a document of the schema. */
export async function writeDraft(forkId: number, gz: Buffer, parentCommitId: number | null): Promise<{ bytes: number; saved_at: string } | null> {
  let json: string
  try {
    json = gunzipSync(gz).toString("utf8")
    if (!readDocJson(JSON.parse(json))) return null
  } catch {
    return null
  }
  const bytes = Buffer.byteLength(json)
  const row = await one<{ saved_at: string }>(
    `insert into fork_drafts (fork_id, doc_gz, doc_bytes, doc_schema, parent_commit_id, saved_at)
     values ($1, decode($2, 'base64'), $3, $4, $5, now())
     on conflict (fork_id) do update set doc_gz = excluded.doc_gz, doc_bytes = excluded.doc_bytes, doc_schema = excluded.doc_schema, parent_commit_id = excluded.parent_commit_id, saved_at = excluded.saved_at
     returning to_char(saved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as saved_at`,
    [forkId, firstSlice(gz), bytes, DOC_SCHEMA, parentCommitId]
  )
  for (let start = SLICE; start < gz.length; start += SLICE) {
    await q(`update fork_drafts set doc_gz = doc_gz || decode($2, 'base64') where fork_id = $1`, [forkId, gz.subarray(start, start + SLICE).toString("base64")])
  }
  return row ? { bytes, saved_at: row.saved_at } : null
}

/** A fork's draft as JSON with when it was saved, or null when it has none or it cannot be read whole. */
export async function readDraft(forkId: number): Promise<{ json: unknown; saved_at: string; parent_commit_id: number | null } | null> {
  const row = await one<{ gz: number | null; saved_at: string; parent_commit_id: number | null }>(`select octet_length(doc_gz) as gz, to_char(saved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as saved_at, parent_commit_id from fork_drafts where fork_id = $1`, [forkId])
  const size = Number(row?.gz ?? 0)
  if (!row || !size) return null
  const parts: Buffer[] = []
  for (let start = 1; start <= size; start += SLICE) {
    const part = await one<{ part: string }>(`select encode(substring(doc_gz from $2::int for $3::int), 'base64') as part from fork_drafts where fork_id = $1`, [forkId, start, SLICE])
    if (!part) return null
    parts.push(Buffer.from(part.part, "base64"))
  }
  try {
    return { json: JSON.parse(gunzipSync(Buffer.concat(parts)).toString("utf8")), saved_at: row.saved_at, parent_commit_id: row.parent_commit_id === null ? null : Number(row.parent_commit_id) }
  } catch {
    // A save cut off between its slices.
    return null
  }
}

/** The part of a document an address names, as a document of its own: a fork of § 16(2) is subdivision 2 alone. */
export function portionOf(json: unknown, identifier: string): unknown | null {
  const doc = readDocJson(json)
  if (!doc) return null
  let found: PmNode | null = null
  doc.descendants((n) => {
    if (found) return false
    if (n.attrs.identifier === identifier) found = n
    return !found
  })
  return found ? docToJson(xmlSchema.nodes.doc.create(doc.attrs, [found])) : null
}
