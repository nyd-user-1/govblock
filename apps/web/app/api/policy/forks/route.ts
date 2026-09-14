import { NextResponse } from "next/server"

import { identify } from "@/lib/auth/user-id"
import { one, q } from "@/lib/policy/db"
import { findExpression, sessionYear, stateOfJurisdiction } from "@/lib/typeset/expression-document"

// A reader's forks — GitHub's model, put to a legislature (Brendan,
// 2026-09-03: "so it's a fork?"). The public owns the legislature, and its
// versions are never edited; a reader who wants to propose a change forks
// and commits in the fork. Forks live in My Files and never in the official
// record.
//
// Two kinds of row. Duplicate to edit is one fork per reader per bill, keyed
// by `bill_id`. A fork of a published unit (window 5, 2026-09-14) is keyed by
// the Work address it copies (a section, a subsection, a printing) and the
// dated base Expression it was read from (sql/011_forks_work.sql), so a fork
// of a statute needs no bill.
//
// Who the reader is comes from `identify()`: the signed-in session when
// there is one, otherwise the browser's claim check, sent as `claim`.

export type ForkRow = {
  id: number
  owner: string
  state: string
  session_id: number | null
  bill_id: number | null
  bill_number: string | null
  title: string | null
  created_at: string
  commits: number
  /** The forked address, for a fork of a published unit. */
  work: string | null
  base_work: string | null
  base_expression: string | null
  kind: string | null
  label: string | null
}

const FORK = `f.id, f.owner, f.state, f.session_id, f.bill_id, f.bill_number, f.title, f.created_at, f.work, f.base_work, f.base_expression, f.kind, f.label,
  (select count(*)::int from "Commits" c where c.fork_id = f.id) commits`

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const who = await identify(sp.get("claim"))
  const id = Number(sp.get("id"))
  if (id) {
    // One fork by id, whoever asks: forks are public, like GitHub's.
    const fork = await one<ForkRow>(`select ${FORK} from "Forks" f where f.id = $1`, [id])
    return NextResponse.json({ forks: fork ? [normalise(fork)] : [] })
  }
  if (!who) return NextResponse.json({ forks: [] })
  const bill = Number(sp.get("bill"))
  const params: unknown[] = [who.id]
  // By bill: the reader's Duplicate to edit copy of it, which a fork of the bill's printing is not.
  const where = bill ? `f.owner = $1 and f.bill_id = $${params.push(bill)} and f.work is null` : "f.owner = $1"
  const forks = await q<ForkRow>(`select ${FORK} from "Forks" f where ${where} order by f.created_at desc`, params)
  return NextResponse.json({ forks: forks.map(normalise) })
}

/** "§ 16" with the portion's own numbers after it: "§ 16(2-e)(ii)". */
function labelOf(work: string, baseWork: string, baseLabel: string | null) {
  const below = work.slice(baseWork.length).split("/").filter(Boolean)
  return `${baseLabel ?? baseWork}${below.map((n) => `(${n})`).join("")}`
}

export async function POST(request: Request) {
  let body: { claim?: string; state?: string; session_id?: number | null; bill_id?: number; bill_number?: string; title?: string; address?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }
  const who = await identify(body.claim)
  if (!who) return NextResponse.json({ error: "who are you? sign in, or send the browser's claim check" }, { status: 401 })

  if (body.address) {
    // A fork of a published unit, from the Expression the address names or the Work's latest.
    const found = await findExpression(body.address)
    if (!found) return NextResponse.json({ error: `nothing stored at ${body.address}` }, { status: 404 })
    const { row, portion } = found
    const work = portion ?? row.work
    const existing = await one<ForkRow>(`select ${FORK} from "Forks" f where f.owner = $1 and f.work = $2 and f.base_expression = $3`, [who.id, work, row.expression])
    if (existing) return NextResponse.json({ fork: normalise(existing), existed: true })
    const made = await one<ForkRow>(
      `with f as (
         insert into "Forks" (owner, state, session_id, bill_id, bill_number, title, work, base_work, base_expression, kind, label)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *
       ) select ${FORK} from f`,
      [who.id, stateOfJurisdiction(row.jurisdiction), row.kind === "bill" ? sessionYear(row.jurisdiction, row.session) : null, Number(body.bill_id) || null, body.bill_number ?? null, body.title ?? row.label, work, row.work, row.expression, row.kind, labelOf(work, row.work, row.label)]
    )
    return NextResponse.json({ fork: made ? normalise(made) : null, existed: false })
  }

  const billId = Number(body.bill_id)
  if (!billId || !body.state) return NextResponse.json({ error: "an address, or state and bill_id, required" }, { status: 400 })
  const existing = await one<ForkRow>(`select ${FORK} from "Forks" f where f.owner = $1 and f.bill_id = $2 and f.work is null`, [who.id, billId])
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
  return { ...f, id: Number(f.id), bill_id: f.bill_id === null ? null : Number(f.bill_id), session_id: f.session_id === null ? null : Number(f.session_id), commits: Number(f.commits ?? 0) }
}
