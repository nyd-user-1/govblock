import { BILLS, TEXTS } from "@/lib/data"
import type { Filters } from "@/lib/filters"
import { sql } from "@/lib/policy/db"
import type { Bill, BillText } from "@/lib/policy/types"

// A bill's own record. Everything the page shows — sponsors, history, votes,
// referrals, progress, same-as, documents, subjects, text versions, hearings —
// is assembled in one statement as jsonb, so a bill page costs one round trip
// rather than eleven. The twelve bills committed under lib/data still answer
// when the database is unreachable, which is what keeps a build without secrets
// rendering.

export type Resolved = Omit<Filters, "state" | "session"> & { state: string; session: number }

export async function resolve(filters: Filters): Promise<Resolved> {
  return { ...filters, state: filters.state || "US", session: Number(filters.session) || 2025 }
}

export function billsOnFile(): Bill[] {
  return (Object.values(BILLS) as unknown as Bill[]).slice().sort((a, b) => String(b.last_action_date ?? "").localeCompare(String(a.last_action_date ?? "")))
}

export async function getBills(f: Resolved, limit = 40, offset = 0) {
  if (sql) {
    try {
      const rows = (await sql`
        select bill_id, bill_number, title, description, status_desc, last_action, last_action_date,
               committee, body, url, state_link, text_chars, sponsor, sponsor_party, sponsor_id, state, session_id
        from public.mv_stream_latest
        where state = ${f.state}
        order by rank
        limit ${limit} offset ${offset}`) as unknown as Bill[]
      if (rows.length) {
        const total = (await sql`
          select count(*)::int as n from public.mv_stream_latest where state = ${f.state}`) as {
          n: number
        }[]
        return { rows, total: Number(total[0]?.n ?? rows.length) }
      }
    } catch (error) {
      console.error("bills: database unavailable, serving snapshot", error)
    }
  }
  const rows = billsOnFile()
  return { rows: rows.slice(offset, offset + limit), total: rows.length }
}

export async function getBill(billId: number): Promise<Bill | null> {
  // /docs/bills/abc reaches here as NaN; sending that to the Data API costs a
  // signed request and its retries before failing.
  if (!Number.isInteger(billId) || billId <= 0) return null
  if (sql) {
    try {
      const rows = (await sql`select
  b.bill_id, b.bill_number, b.title, b.description, b.status_desc, b.last_action, b.last_action_date,
  b.committee, b.body, b.url, b.state_link, b.text_chars,
  b.state, b.session_id, b.session_title, b.status_date, b.bill_type,
  sp.name as sponsor, sp.party as sponsor_party, sp.people_id as sponsor_id,
  coalesce((select jsonb_agg(jsonb_build_object(
      'people_id', p.people_id, 'name', p.name, 'party', p.party, 'role', p.role,
      'district', p.district, 'chamber', p.chamber, 'type', s.sponsor_type_id,
      'photo_url', p.photo_url, 'bioguide_id', p.bioguide_id) order by s.position)
    from "Sponsors" s join "People" p using (people_id) where s.bill_id = b.bill_id), '[]') as sponsors,
  coalesce((select jsonb_agg(jsonb_build_object(
      'date', h.date, 'chamber', h.chamber, 'action', h.action, 'sequence', h.sequence)
      order by h.sequence)
    from "History Table" h where h.bill_id = b.bill_id), '[]') as history,
  coalesce((select jsonb_agg(jsonb_build_object(
      'roll_call_id', r.roll_call_id, 'date', r.date, 'chamber', r.chamber, 'description', r.description,
      'yea', r.yea::int, 'nay', coalesce(nullif(r.nay,'')::int, 0),
      'nv', coalesce(nullif(r.nv,'')::int, 0), 'absent', coalesce(nullif(r.absent,'')::int, 0),
      'total', r.total::int) order by r.date desc)
    from "Roll Call" r where r.bill_id = b.bill_id), '[]') as "rollCalls",
  coalesce((select jsonb_agg(jsonb_build_object(
      'date', rf.date, 'chamber', rf.chamber, 'name', rf.name) order by rf.seq)
    from "Referrals" rf where rf.bill_id = b.bill_id), '[]') as referrals,
  coalesce((select jsonb_agg(jsonb_build_object('date', pg.date, 'event', pg.event) order by pg.seq)
    from "Progress" pg where pg.bill_id = b.bill_id), '[]') as progress,
  coalesce((select jsonb_agg(jsonb_build_object(
      'sast_type', sa.sast_type, 'sast_bill_id', sa.sast_bill_id, 'sast_bill_number', sa.sast_bill_number))
    from "SameAs" sa where sa.bill_id = b.bill_id), '[]') as "sameAs",
  coalesce((select jsonb_agg(jsonb_build_object(
      'document_id', d.document_id, 'document_type', d.document_type, 'document_desc', d.document_desc,
      'url', d.url, 'state_link', d.state_link))
    from "Documents" d where d.bill_id = b.bill_id), '[]') as documents,
  coalesce((select jsonb_agg(distinct su.subject) from "Subjects" su where su.bill_id = b.bill_id), '[]') as subjects,
  coalesce((select jsonb_agg(jsonb_build_object(
      'document_id', t.document_id, 'version', t.version, 'chars', t.chars,
      'fetched_at', t.fetched_at, 'source', t.source) order by t.document_id desc)
    from "BillTexts" t where t.bill_id = b.bill_id), '[]') as texts,
  coalesce((select jsonb_agg(jsonb_build_object(
      'date', c.date, 'time', c.time, 'type', c.type, 'description', c.description,
      'location', c.location) order by c.date, c.time)
    from "Calendar" c where c.bill_id = b.bill_id), '[]') as hearings
  from "Bills" b
  left join lateral (
    select p.name, p.party, p.people_id from "Sponsors" s join "People" p using (people_id)
    where s.bill_id = b.bill_id and s.sponsor_type_id = 1 order by s.position limit 1) sp on true
        where b.bill_id = ${billId}`) as unknown as Bill[]
      if (rows[0]) return rows[0]
    } catch (error) {
      console.error("bill: database unavailable, serving snapshot", error)
    }
  }
  return ((BILLS as Record<string, unknown>)[String(billId)] as Bill | undefined) ?? null
}

export async function getBillText(billId: number, documentId?: number): Promise<BillText | null> {
  if (!Number.isInteger(billId) || billId <= 0) return null
  if (sql) {
    try {
      // left() keeps one very long bill inside the Data API's 1 MB result cap;
      // the whole text is in the lake if it is ever needed in full.
      const rows = (await sql`
        select t.document_id, t.version, t.chars, t.fetched_at,
               left(t.text, 800000) as text, d.document_desc, d.date
        from "BillTexts" t
        left join "Documents" d on d.document_id = t.document_id
        where t.bill_id = ${billId} and t.text is not null
          and (${documentId ?? null}::bigint is null or t.document_id = ${documentId ?? null}::bigint)
        order by t.document_id desc
        limit 1`) as unknown as BillText[]
      if (rows[0]) return rows[0]
    } catch (error) {
      console.error("bill text: database unavailable, serving snapshot", error)
    }
  }
  const bill = ((BILLS as Record<string, unknown>)[String(billId)] as Bill | undefined) ?? null
  const meta = bill?.texts.find((t) => !documentId || t.document_id === documentId) ?? bill?.texts[0]
  const key = String(documentId ?? meta?.document_id ?? billId)
  const text = TEXTS[key] ?? TEXTS[String(billId)]
  if (!text) return null
  return { document_id: meta?.document_id ?? billId, version: text.version ?? meta?.version ?? null, chars: text.chars ?? text.text.length, fetched_at: meta?.fetched_at ?? null, text: text.text, document_desc: null, date: null }
}
