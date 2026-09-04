import { NextResponse } from "next/server"

import { identify } from "@/lib/auth/user-id"
import { one, q } from "@/lib/policy/db"

// A reader's forks of bills — GitHub's model, put to a legislature (Brendan,
// 2026-09-03: "so it's a fork?"). The public owns the legislature, and its
// versions are never edited; a reader who wants to propose a change forks
// the bill and commits in the fork. One fork per reader per bill.
//
// Who the reader is comes from `identify()`: the signed-in session when
// there is one, otherwise the browser's claim check, sent as `claim`.

export type ForkRow = { id: number; owner: string; state: string; session_id: number | null; bill_id: number; bill_number: string | null; title: string | null; created_at: string; commits: number }

const FORK = `f.id, f.owner, f.state, f.session_id, f.bill_id, f.bill_number, f.title, f.created_at,
  (select count(*)::int from "Commits" c where c.fork_id = f.id) commits`

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const who = await identify(sp.get("claim"))
  if (!who) return NextResponse.json({ forks: [] })
  const id = Number(sp.get("id"))
  if (id) {
    // One fork by id, whoever asks: forks are public, like GitHub's.
    const fork = await one<ForkRow>(`select ${FORK} from "Forks" f where f.id = $1`, [id])
    return NextResponse.json({ forks: fork ? [fork] : [] })
  }
  const bill = Number(sp.get("bill"))
  const params: unknown[] = [who.id]
  const where = bill ? `f.owner = $1 and f.bill_id = $${params.push(bill)}` : "f.owner = $1"
  const forks = await q<ForkRow>(`select ${FORK} from "Forks" f where ${where} order by f.created_at desc`, params)
  return NextResponse.json({ forks: forks.map(normalise) })
}

export async function POST(request: Request) {
  let body: { claim?: string; state?: string; session_id?: number | null; bill_id?: number; bill_number?: string; title?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }
  const who = await identify(body.claim)
  if (!who) return NextResponse.json({ error: "who are you? sign in, or send the browser's claim check" }, { status: 401 })
  const billId = Number(body.bill_id)
  if (!billId || !body.state) return NextResponse.json({ error: "state and bill_id required" }, { status: 400 })
  const existing = await one<ForkRow>(`select ${FORK} from "Forks" f where f.owner = $1 and f.bill_id = $2`, [who.id, billId])
  if (existing) return NextResponse.json({ fork: normalise(existing), existed: true })
  const made = await one<ForkRow>(
    `with f as (
       insert into "Forks" (owner, state, session_id, bill_id, bill_number, title) values ($1, $2, $3, $4, $5, $6) returning *
     ) select ${FORK} from f`,
    [who.id, body.state, body.session_id ?? null, billId, body.bill_number ?? null, body.title ?? null]
  )
  return NextResponse.json({ fork: made ? normalise(made) : null, existed: false })
}

function normalise(f: ForkRow): ForkRow {
  return { ...f, id: Number(f.id), bill_id: Number(f.bill_id), session_id: f.session_id === null ? null : Number(f.session_id), commits: Number(f.commits ?? 0) }
}
