import { NextResponse } from "next/server"

import { one, q } from "@/lib/policy/db"
import { getWatch } from "@/lib/watches/db"
import { who } from "@/lib/watches/session"

// A test event for a watch: the bill's real latest action (or a hearing on
// its calendar, or its latest roll call) written as tonight's event, so the
// next tick runs the watch without waiting for the record to move. What it
// produces is real; only the timing is borrowed.

export const dynamic = "force-dynamic"

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const { id } = await params
  const watch = await getWatch(user.id, id)
  if (!watch) return NextResponse.json({ error: "not found" }, { status: 404 })
  const t = watch.trigger
  const billId = "bill_id" in t && t.bill_id ? Number(t.bill_id) : null
  const bill = billId
    ? await one<{
        bill_id: number
        state: string
        bill_number: string
        title: string
        description: string
        status_desc: string
        last_action: string
        last_action_date: string
        committee: string | null
        body: string | null
        url: string
        session_id: number
      }>(`select bill_id, state, bill_number, title, description, status_desc, last_action, last_action_date, committee, body, url, session_id from "Bills" where bill_id = $1`, [billId])
    : null

  let kind: string,
    payload: Record<string, unknown>,
    state: string | null = bill?.state ?? ("state" in t ? (t.state ?? null) : null)
  switch (t.kind) {
    case "bill.action":
      if (!bill) return NextResponse.json({ error: "no bill" }, { status: 400 })
      kind = "bill.action"
      payload = {
        bill_number: bill.bill_number,
        title: bill.title,
        session_id: bill.session_id,
        old_status_desc: null,
        new_status_desc: bill.status_desc,
        last_action: bill.last_action,
        last_action_date: bill.last_action_date,
        committee: bill.committee,
        body: bill.body,
        url: bill.url,
        test: true,
      }
      break
    case "text.landed": {
      if (!bill) return NextResponse.json({ error: "no bill" }, { status: 400 })
      const doc = await one<{ document_id: number; version: string | null; chars: number }>(`select document_id, version, chars from "BillTexts" where bill_id = $1 and text is not null order by document_id desc limit 1`, [billId])
      if (!doc) return NextResponse.json({ error: "no text on file for this bill yet" }, { status: 400 })
      kind = "text.landed"
      payload = { bill_number: bill.bill_number, title: bill.title, document_id: doc.document_id, version: doc.version, chars: doc.chars, test: true }
      break
    }
    case "rollcall.recorded": {
      const rc = await one<{
        bill_id: number
        roll_call_id: number
        date: string
        chamber: string
        description: string
        yea: number
        nay: string
        nv: string
        absent: string
        total: number
        bill_number: string
        title: string
        state: string
      }>(
        billId
          ? `select r.*, b.bill_number, b.title, b.state from "Roll Call" r join "Bills" b using (bill_id) where r.bill_id = $1 order by r.date desc limit 1`
          : `select r.*, b.bill_number, b.title, b.state from "Roll Call" r join "Bills" b using (bill_id) where b.state = $1 order by r.date desc limit 1`,
        [billId ?? t.state]
      )
      if (!rc) return NextResponse.json({ error: "no roll call on file" }, { status: 400 })
      kind = "rollcall.recorded"
      state = rc.state
      payload = {
        bill_number: rc.bill_number,
        title: rc.title,
        roll_call_id: rc.roll_call_id,
        date: rc.date,
        chamber: rc.chamber,
        description: rc.description,
        yea: rc.yea,
        nay: Number(rc.nay) || 0,
        nv: Number(rc.nv) || 0,
        absent: Number(rc.absent) || 0,
        total: rc.total,
        test: true,
      }
      await q(`insert into watch_events (kind, state, bill_id, payload) values ($1, $2, $3, $4::jsonb)`, [kind, state, rc.bill_id, JSON.stringify(payload)])
      return NextResponse.json({ ok: true, kind })
    }
    case "hearing.scheduled": {
      const c = await one<{ bill_id: number; date: string; time: string; type: string; description: string; location: string; bill_number: string; title: string; committee: string | null; state: string }>(
        `select c.bill_id, c.date, c.time, c.type, c.description, c.location, b.bill_number, b.title, b.committee, b.state from "Calendar" c join "Bills" b using (bill_id) where b.state = $1 ${t.committee ? "and c.description ilike $2" : ""} order by c.date desc limit 1`,
        t.committee ? [t.state, `%${t.committee}%`] : [t.state]
      )
      if (!c) return NextResponse.json({ error: "no hearing on file for that committee" }, { status: 400 })
      kind = "hearing.scheduled"
      state = c.state
      payload = { bill_number: c.bill_number, title: c.title, date: c.date, time: c.time, type: c.type, description: c.description, location: c.location, committee: c.committee, test: true }
      await q(`insert into watch_events (kind, state, bill_id, committee, payload) values ($1, $2, $3, $4, $5::jsonb)`, [kind, state, c.bill_id, c.committee, JSON.stringify(payload)])
      return NextResponse.json({ ok: true, kind })
    }
    case "bill.introduced": {
      const b = await one<{ bill_id: number; state: string; bill_number: string; title: string; description: string; committee: string | null; body: string | null; url: string }>(
        `select bill_id, state, bill_number, title, description, committee, body, url from "Bills" where ${t.state && t.state !== "all" ? "state = $1 and" : ""} ${t.keyword ? "(title ilike $2 or description ilike $2) and" : ""} true order by created_at desc nulls last limit 1`,
        [t.state && t.state !== "all" ? t.state : "NY", `%${t.keyword ?? ""}%`]
      )
      if (!b) return NextResponse.json({ error: "no bill matches" }, { status: 400 })
      kind = "bill.introduced"
      state = b.state
      payload = { bill_number: b.bill_number, title: b.title, description: b.description, committee: b.committee, body: b.body, url: b.url, sponsor_ids: [], sponsors: [], test: true }
      await q(`insert into watch_events (kind, state, bill_id, committee, payload) values ($1, $2, $3, $4, $5::jsonb)`, [kind, state, b.bill_id, b.committee, JSON.stringify(payload)])
      return NextResponse.json({ ok: true, kind })
    }
    default:
      return NextResponse.json({ error: "this watch runs on the clock; it fires when its time comes" }, { status: 400 })
  }
  await q(`insert into watch_events (kind, state, bill_id, committee, payload) values ($1, $2, $3, $4, $5::jsonb)`, [kind, state, billId, bill?.committee ?? null, JSON.stringify(payload)])
  return NextResponse.json({ ok: true, kind })
}
