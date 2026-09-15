import { NextResponse } from "next/server"

import { q } from "@/lib/policy/db"
import { frontEndFor } from "@/lib/xml/frontends"
import type { CoverageLine, Source } from "@/lib/xml/ir"

// The Compiler page's "measure" button (the lead, 2026-09-14): a small live
// sample of a jurisdiction's stored documents through its front end, the
// same measurement scripts/xml/coverage.mjs makes, without a terminal.
// Development only in practice: a sample of eight is ten to thirty seconds
// over the Data API, past Amplify's cut-off. The file the Compiler page
// draws from is written by the script, not here.
//
//   GET /api/xml/measure?jurisdiction=NY&source=texts|laws|documents&sample=8

export const dynamic = "force-dynamic"

async function sources(jurisdiction: string, source: string, sample: number): Promise<Source[]> {
  if (source === "documents") {
    const rows = await q<{ url: string }>(`select d.url from "Documents" d join "Bills" b on b.bill_id = d.bill_id where b.state = $1 and d.url ilike '%.xml%' order by random() limit $2`, [jurisdiction, sample])
    const out: Source[] = []
    for (const r of rows) {
      try {
        const res = await fetch(r.url, { headers: { "user-agent": "govblock (+https://gov.nysgpt.com)" } })
        if (res.ok) out.push({ kind: "xml", body: await res.text(), url: r.url })
      } catch {}
    }
    return out
  }
  if (source === "laws") {
    const rows = await q<{ id: string; law_id: string; doc_type: string; text: string }>(`select location_id as id, law_id, doc_type, text from "Laws" where state = $1 and text is not null and length(text) > 200 order by random() limit $2`, [jurisdiction, sample])
    return rows.map((r) => ({ kind: "text", body: r.text, url: `laws:${r.law_id}/${r.id}`, meta: { kind: "law", doc_type: r.doc_type, location_id: r.id, law_id: r.law_id } }))
  }
  const bills = await q<{ bill_id: number }>(`select bill_id from "Bills" where state = $1 and session_id >= $2 order by random() limit $3`, [jurisdiction, new Date().getFullYear() - 3, sample])
  if (!bills.length) return []
  const ids = `{${bills.map((b) => Number(b.bill_id)).join(",")}}`
  const rows = await q<{ id: number; text: string }>(`select t.document_id as id, t.text from "BillTexts" t where t.bill_id = any($1::bigint[]) and t.text is not null and length(t.text) > 200 and coalesce(t.version, '') not ilike '%memo%' order by t.bill_id, t.document_id desc`, [ids])
  const seen = new Set<number>()
  return rows
    .filter((r) => !seen.has(Number(r.id)) && seen.add(Number(r.id)))
    .slice(0, sample)
    .map((r) => ({ kind: "text", body: r.text, url: `texts:${r.id}`, meta: { kind: "bill" } }))
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const jurisdiction = (sp.get("jurisdiction") ?? "US").toUpperCase()
  const source = sp.get("source") ?? (jurisdiction === "US" ? "documents" : "texts")
  const sample = Math.min(24, Math.max(1, Number(sp.get("sample") ?? 8)))
  const fe = frontEndFor(jurisdiction)
  const docs = await sources(jurisdiction, source, sample)
  const dialects: Record<string, number> = {}
  const unknown: Record<string, number> = {}
  const fallouts: Record<string, number> = {}
  let clean = 0
  let sum = 0
  for (const s of docs) {
    const { report } = fe.parse(s)
    dialects[report.dialect] = (dialects[report.dialect] ?? 0) + 1
    sum += report.coverage
    if (report.coverage === 1 && report.dialect !== "unknown") clean++
    for (const [k, v] of Object.entries(report.unknown)) unknown[k] = (unknown[k] ?? 0) + v
    for (const note of report.notes) {
      const key = note.replace(/\d+/g, "N").replace(/:\s.*$/, "").slice(0, 60)
      fallouts[key] = (fallouts[key] ?? 0) + 1
    }
  }
  const line: CoverageLine & { fallouts: Record<string, number> } = {
    jurisdiction,
    name: fe.profile.name,
    source,
    sampled: docs.length,
    clean,
    coverage: docs.length ? Number((sum / docs.length).toFixed(4)) : 0,
    dialects,
    unknown,
    fallouts,
    measuredAt: new Date().toISOString(),
  }
  return NextResponse.json(line, { headers: { "cache-control": "no-store" } })
}
