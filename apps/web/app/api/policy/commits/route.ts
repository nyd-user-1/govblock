import { NextResponse } from "next/server"

import { identify } from "@/lib/auth/user-id"
import { one, q } from "@/lib/policy/db"
import { appendSlices, commitPayload, DOC_SCHEMA, firstSlice, readCommitDoc, readDocJson } from "@/lib/typeset/fork-store"

// Commits in a fork: the fork's own Expressions, each with a parent (an
// official document, an earlier commit, or for a fork of a published unit
// the dated base the fork was made from), a message and a description the
// way GitHub asks for them. A commit of a Duplicate to edit copy holds text;
// a commit of a fork of a published unit holds its document (window 5,
// 2026-09-14), the ProseMirror JSON of the USLM schema, with its plain text
// beside it. Anyone can read a fork's commits; only the fork's owner can add
// one. A bill's own record never lists them.

export type CommitRow = { id: number; fork_id: number; parent_document_id: number | null; parent_commit_id: number | null; message: string; description: string; text: string; author: string; created_at: string; doc_bytes: number | null }

const COMMIT = `id, fork_id, parent_document_id, parent_commit_id, message, description, text, author, created_at, doc_bytes`

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const id = Number(sp.get("id"))
  if (id) {
    const commit = await one<CommitRow>(`select ${COMMIT} from "Commits" where id = $1`, [id])
    if (!commit) return NextResponse.json({ error: "no such commit" }, { status: 404 })
    return NextResponse.json({ commit: normalise(commit), doc: commit.doc_bytes ? await readCommitDoc(id) : null })
  }
  const fork = Number(sp.get("fork"))
  if (!fork) return NextResponse.json({ commits: [] })
  const commits = await q<CommitRow>(`select ${COMMIT} from "Commits" where fork_id = $1 order by id desc`, [fork])
  return NextResponse.json({ commits: commits.map(normalise) })
}

export async function POST(request: Request) {
  let body: { claim?: string; fork_id?: number; parent_document_id?: number | null; parent_commit_id?: number | null; message?: string; description?: string; text?: string; doc?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }
  const who = await identify(body.claim)
  if (!who) return NextResponse.json({ error: "who are you? sign in, or send the browser's claim check" }, { status: 401 })
  const forkId = Number(body.fork_id)
  const message = String(body.message ?? "").trim()
  if (!forkId || !message || (typeof body.text !== "string" && body.doc == null)) return NextResponse.json({ error: "fork_id, message and text or doc required" }, { status: 400 })
  const fork = await one<{ owner: string }>(`select owner from "Forks" where id = $1`, [forkId])
  if (!fork) return NextResponse.json({ error: "no such fork" }, { status: 404 })
  if (fork.owner !== who.id) return NextResponse.json({ error: "not your fork" }, { status: 403 })

  let text = body.text ?? ""
  let payload: ReturnType<typeof commitPayload> | null = null
  if (body.doc != null) {
    const doc = readDocJson(body.doc)
    if (!doc) return NextResponse.json({ error: "doc is not a document of the USLM schema" }, { status: 400 })
    payload = commitPayload(doc)
    text = payload.text
  }

  const made = await one<CommitRow>(
    `insert into "Commits" (fork_id, parent_document_id, parent_commit_id, message, description, text, author, doc_gz, doc_bytes, doc_schema)
     values ($1, $2, $3, $4, $5, $6, $7, decode($8, 'base64'), $9, $10) returning ${COMMIT}`,
    [forkId, body.parent_document_id ?? null, body.parent_commit_id ?? null, message, String(body.description ?? ""), text, who.kind === "user" ? who.id : "you", payload ? firstSlice(payload.gz) : null, payload?.bytes ?? null, payload ? DOC_SCHEMA : null]
  )
  if (made && payload) await appendSlices(Number(made.id), payload.gz)
  return NextResponse.json({ commit: made ? normalise(made) : null })
}

function normalise(c: CommitRow): CommitRow {
  return { ...c, id: Number(c.id), fork_id: Number(c.fork_id), parent_document_id: c.parent_document_id === null ? null : Number(c.parent_document_id), parent_commit_id: c.parent_commit_id === null ? null : Number(c.parent_commit_id), doc_bytes: c.doc_bytes === null ? null : Number(c.doc_bytes) }
}
