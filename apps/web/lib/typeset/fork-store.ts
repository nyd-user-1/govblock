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
