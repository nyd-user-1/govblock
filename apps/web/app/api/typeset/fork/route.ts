import { NextResponse } from "next/server"
import { gzipSync } from "node:zlib"

import { identify } from "@/lib/auth/user-id"
import { currentSession, gate } from "@/lib/entitlements-server"
import { one, q } from "@/lib/policy/db"
import { expressionOf } from "@/lib/policy/expressions"
import { askOf, getExpressionDocument } from "@/lib/typeset/expression-document"
import { portionOf, readCommitDoc, readDraft } from "@/lib/typeset/fork-store"
import { parseAddress } from "@/lib/xml/address"
import type { ForkRow } from "@/app/api/policy/forks/route"

// A fork of a published unit, as the Fork view opens it (window 5,
// 2026-09-14): the dated base it was forked from, as the reader's JSON (the
// portion alone when the fork is of a subsection), the fork's latest
// committed document, its commits, and how an amendment cites the law. The
// view diffs the two in the browser (lib/typeset/amend.ts). Gated as the base
// is: a printing as its bill, a section as the laws. To the fork's owner, the
// working document saved since the last commit (2026-09-15), which the view
// opens on.
//
//   GET /api/typeset/fork?id=<fork id>

export const dynamic = "force-dynamic"

type CommitLine = { id: number; message: string; description: string; author: string; created_at: string; parent_commit_id: number | null; doc_bytes: number | null }

/** A state code's name as its bill would print it, from "Laws"; New York's are in the engine's own table. */
async function lawNameOf(work: string, jurisdiction: string, kind: string): Promise<string | null> {
  if (kind !== "code" || jurisdiction === "us-ny" || jurisdiction === "us") return null
  const code = work.split("/")[3]
  if (!code) return null
  const row = await one<{ law_name: string | null }>(`select law_name from "Laws" where state = $1 and law_id = $2 and law_name is not null limit 1`, [jurisdiction.replace(/^us-/, "").toUpperCase(), code.toUpperCase()]).catch(() => null)
  return row?.law_name ?? null
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const id = Number(sp.get("id"))
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const fork = await one<ForkRow>(`select id, owner, state, session_id, bill_id, bill_number, title, created_at, work, base_work, base_expression, kind, label, 0 as commits from "Forks" where id = $1`, [id])
  if (!fork?.work || !fork.base_work || !fork.base_expression) return NextResponse.json({ error: "no fork of a published unit with that id" }, { status: 404 })

  const row = await expressionOf(fork.base_work, fork.base_expression)
  if (!row) return NextResponse.json({ error: `the base ${fork.base_work}@${fork.base_expression} is no longer stored` }, { status: 404 })
  const ask = askOf(row)
  const { refusal } = await gate(request, { ...ask, current: ask.entity === "bills" ? await currentSession(ask.state!).catch(() => null) : undefined })
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: { "cache-control": "private, no-store" } })

  // The index's kind is "bill" or "statute"; an amendment cites by the address's ("usc", "code", "const").
  const kind = parseAddress(row.work)?.kind ?? row.kind
  const [document, commits, name, who] = await Promise.all([
    getExpressionDocument(row, null),
    q<CommitLine>(`select id, message, description, author, created_at::text as created_at, parent_commit_id, doc_bytes from "Commits" where fork_id = $1 order by id desc`, [id]),
    lawNameOf(row.work, row.jurisdiction, kind),
    identify(sp.get("claim")),
  ])
  const base = fork.work === row.work ? document.json : portionOf(document.json, fork.work)
  if (!base) return NextResponse.json({ error: `${fork.work} is not in ${row.work}@${row.expression}` }, { status: 404 })
  const head = commits.find((c) => c.doc_bytes)
  const headDoc = head ? await readCommitDoc(Number(head.id)) : null
  // The draft only when it was saved after the last commit: a commit made elsewhere since is the newer text.
  const draft = who?.id === fork.owner ? await readDraft(id) : null
  const headAt = head ? Date.parse(head.created_at.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")) : NaN
  const draftCurrent = draft && !(headAt > Date.parse(draft.saved_at))

  const json = JSON.stringify({
    fork: { ...fork, id: Number(fork.id), commits: commits.length },
    base: { address: `${row.work}@${row.expression}`, date: row.expression_date, label: row.label, fidelity: row.fidelity, coverage: row.coverage === null ? null : Number(row.coverage), json: base },
    head: head && headDoc ? { id: Number(head.id), json: headDoc } : null,
    draft: draftCurrent && draft ? { json: draft.json, saved_at: draft.saved_at, parent_commit_id: draft.parent_commit_id } : null,
    commits: commits.map((c) => ({ ...c, id: Number(c.id), parent_commit_id: c.parent_commit_id === null ? null : Number(c.parent_commit_id), doc_bytes: c.doc_bytes === null ? null : Number(c.doc_bytes) })),
    cite: { jurisdiction: row.jurisdiction, kind, work: row.work, name },
  })
  const gzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")
  return new NextResponse(gzip ? new Uint8Array(gzipSync(json)) : json, {
    headers: { "content-type": "application/json", vary: "accept-encoding", "cache-control": "private, no-store", ...(gzip ? { "content-encoding": "gzip" } : {}) },
  })
}
