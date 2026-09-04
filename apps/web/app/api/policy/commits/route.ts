import { NextResponse } from "next/server"

import { identify } from "@/lib/auth/user-id"
import { one, q } from "@/lib/policy/db"

// Commits in a fork: the fork's own versions of the bill's text, each with a
// parent (an official document, or an earlier commit), a message and a
// description the way GitHub asks for them, and the whole text. Anyone can
// read a fork's commits; only the fork's owner can add one.

export type CommitRow = { id: number; fork_id: number; parent_document_id: number | null; parent_commit_id: number | null; message: string; description: string; text: string; author: string; created_at: string }

const COMMIT = `id, fork_id, parent_document_id, parent_commit_id, message, description, text, author, created_at`

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const fork = Number(sp.get("fork"))
  const bill = Number(sp.get("bill"))
  if (bill) {
    // Every fork's commits on a bill, with whose fork each is: forks are
    // public, and a bill's timeline shows what everyone proposed (Brendan,
    // 2026-09-04: "no one will ever see the forks made by other people and
    // here we want that to happen").
    const commits = await q<CommitRow & { owner: string }>(
      `select c.id, c.fork_id, c.parent_document_id, c.parent_commit_id, c.message, c.description, c.text, c.author, c.created_at, f.owner
         from "Commits" c join "Forks" f on f.id = c.fork_id where f.bill_id = $1 order by c.id desc`,
      [bill]
    )
    return NextResponse.json({ commits: commits.map((c) => ({ ...normalise(c), owner: c.owner })) })
  }
  if (!fork) return NextResponse.json({ commits: [] })
  const commits = await q<CommitRow>(`select ${COMMIT} from "Commits" where fork_id = $1 order by id desc`, [fork])
  return NextResponse.json({ commits: commits.map(normalise) })
}

export async function POST(request: Request) {
  let body: { claim?: string; fork_id?: number; parent_document_id?: number | null; parent_commit_id?: number | null; message?: string; description?: string; text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }
  const who = await identify(body.claim)
  if (!who) return NextResponse.json({ error: "who are you? sign in, or send the browser's claim check" }, { status: 401 })
  const forkId = Number(body.fork_id)
  const message = String(body.message ?? "").trim()
  if (!forkId || !message || typeof body.text !== "string") return NextResponse.json({ error: "fork_id, message and text required" }, { status: 400 })
  const fork = await one<{ owner: string }>(`select owner from "Forks" where id = $1`, [forkId])
  if (!fork) return NextResponse.json({ error: "no such fork" }, { status: 404 })
  if (fork.owner !== who.id) return NextResponse.json({ error: "not your fork" }, { status: 403 })
  const made = await one<CommitRow>(
    `insert into "Commits" (fork_id, parent_document_id, parent_commit_id, message, description, text, author)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${COMMIT}`,
    [forkId, body.parent_document_id ?? null, body.parent_commit_id ?? null, message, String(body.description ?? ""), body.text, who.kind === "user" ? who.id : "you"]
  )
  return NextResponse.json({ commit: made ? normalise(made) : null })
}

function normalise(c: CommitRow): CommitRow {
  return { ...c, id: Number(c.id), fork_id: Number(c.fork_id), parent_document_id: c.parent_document_id === null ? null : Number(c.parent_document_id), parent_commit_id: c.parent_commit_id === null ? null : Number(c.parent_commit_id) }
}
