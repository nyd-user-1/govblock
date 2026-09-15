import { NextResponse } from "next/server"

import { identify } from "@/lib/auth/user-id"
import { one, q } from "@/lib/policy/db"
import type { NewComment, SavedComment } from "@/lib/typeset/comments"

// A reader's comments on a Typeset document (sql/026_comments.sql,
// 2026-09-15). Signed in only: a comment is kept for its reader, and a
// signed-out reader has no one to keep it for. Never cached (`comments` is on
// VOLATILE); read only when a view asks, which is when it opens.
//
//   GET    ?document=/us/bill/119/hr/6644@2026-06-25_enr     the reader's comments on it
//   POST   { threadId, document, billId, block, quote, body, rich }
//   PATCH  { id, body, rich }  or  { threadId, resolved: true }
//   DELETE ?id=12  or  ?thread=<thread id>

export const dynamic = "force-dynamic"

// Times as ISO strings every browser's Date reads.
const iso = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ${column}`
const COLUMNS = `id, thread_id, block, quote, body, rich::text as rich, resolved, ${iso("created_at")}, ${iso("edited_at")}`
type Row = { id: number; thread_id: string; block: string; quote: string | null; body: string; rich: string | null; resolved: boolean; created_at: string; edited_at: string | null }

const shape = (r: Row): SavedComment => ({
  id: Number(r.id),
  threadId: r.thread_id,
  block: r.block,
  quote: r.quote,
  body: r.body,
  rich: r.rich ? JSON.parse(r.rich) : null,
  resolved: r.resolved === true || String(r.resolved) === "true",
  createdAt: r.created_at,
  editedAt: r.edited_at,
})

const NO_STORE = { "cache-control": "private, no-store" }
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

async function reader() {
  const who = await identify()
  return who?.kind === "user" ? who.id : null
}

export async function GET(request: Request) {
  const document = text(new URL(request.url).searchParams.get("document"), 400)
  if (!document) return NextResponse.json({ error: "document required" }, { status: 400 })
  const id = await reader()
  if (!id) return NextResponse.json({ comments: [], signedIn: false }, { headers: NO_STORE })
  const rows = await q<Row>(`select ${COLUMNS} from comments where reader = $1 and document = $2 order by created_at`, [id, document])
  return NextResponse.json({ comments: rows.map(shape), signedIn: true }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const id = await reader()
  if (!id) return NextResponse.json({ error: "Sign in to keep comments." }, { status: 401 })
  const input = (await request.json().catch(() => null)) as Partial<NewComment> | null
  const threadId = text(input?.threadId, 80)
  const document = text(input?.document, 400)
  const block = text(input?.block, 400)
  const body = text(input?.body, 20_000).trim()
  if (!threadId || !document || !block || !body) return NextResponse.json({ error: "threadId, document, block and body required" }, { status: 400 })
  const billId = Number(input?.billId) || null
  const rich = input?.rich == null ? null : JSON.stringify(input.rich).slice(0, 200_000)
  const row = await one<Row>(
    `insert into comments (thread_id, reader, bill_id, document, block, quote, body, rich)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     returning ${COLUMNS}`,
    [threadId, id, billId, document, block, text(input?.quote, 2_000) || null, body, rich]
  )
  return NextResponse.json({ comment: row ? shape(row) : null }, { headers: NO_STORE })
}

export async function PATCH(request: Request) {
  const id = await reader()
  if (!id) return NextResponse.json({ error: "Sign in to keep comments." }, { status: 401 })
  const input = (await request.json().catch(() => null)) as { id?: number; body?: string; rich?: unknown; threadId?: string; resolved?: boolean } | null
  if (input?.threadId && input.resolved === true) {
    await q(`update comments set resolved = true where reader = $1 and thread_id = $2`, [id, text(input.threadId, 80)])
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }
  const commentId = Number(input?.id)
  const body = text(input?.body, 20_000).trim()
  if (!commentId || !body) return NextResponse.json({ error: "id and body required" }, { status: 400 })
  const rich = input?.rich == null ? null : JSON.stringify(input.rich).slice(0, 200_000)
  const row = await one<Row>(`update comments set body = $3, rich = $4::jsonb, edited_at = now() where reader = $1 and id = $2 returning ${COLUMNS}`, [id, commentId, body, rich])
  if (!row) return NextResponse.json({ error: "no such comment" }, { status: 404 })
  return NextResponse.json({ comment: shape(row) }, { headers: NO_STORE })
}

export async function DELETE(request: Request) {
  const id = await reader()
  if (!id) return NextResponse.json({ error: "Sign in to keep comments." }, { status: 401 })
  const sp = new URL(request.url).searchParams
  const thread = text(sp.get("thread"), 80)
  const commentId = Number(sp.get("id"))
  if (thread) await q(`delete from comments where reader = $1 and thread_id = $2`, [id, thread])
  else if (commentId) await q(`delete from comments where reader = $1 and id = $2`, [id, commentId])
  else return NextResponse.json({ error: "id or thread required" }, { status: 400 })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
