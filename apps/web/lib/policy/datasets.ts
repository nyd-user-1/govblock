import "server-only"

import { q } from "@/lib/policy/db"

// A session as a file (Brendan, 2026-09-05: "dataset/new-york/2025/bills").
// Every family is read in keyset pages of a thousand rows — the Data API
// answers at most a megabyte a statement, and a session's votes run to
// hundreds of thousands of rows — and the route streams the pages out as one
// JSON array or one CSV. Nothing here reads a text: the texts are their own
// route, one at a time, and a session's worth is gigabytes.

export type DatasetFamily = "bills" | "sponsors" | "members" | "committees" | "rollcalls" | "votes" | "history"
export const DATASET_FAMILY_NAMES: DatasetFamily[] = ["bills", "sponsors", "members", "committees", "rollcalls", "votes", "history"]

type Row = Record<string, unknown>
const PAGE = 1000

/**
 * The next page of a family after a cursor, and the cursor to continue from.
 * The cursor is the ordering key of the last row, so a page never repeats a
 * row and never skips one however long the read takes.
 */
export async function datasetPage(family: DatasetFamily, state: string, session: number, cursor: unknown[] | null): Promise<{ rows: Row[]; next: unknown[] | null }> {
  const after = (n: number) => (cursor ? cursor : Array(n).fill(null))
  switch (family) {
    case "bills": {
      const [id] = after(1)
      const rows = await q<Row>(
        `select b.bill_id, b.bill_number, b.title, b.description, b.status_desc, b.status_date, b.last_action, b.last_action_date,
                b.committee, b.body as chamber, b.url, b.state_link,
                (select p.name from "Sponsors" s join "People" p using (people_id)
                  where s.bill_id = b.bill_id and s.sponsor_type_id = 1 order by s.position limit 1) as sponsor
           from "Bills" b
          where b.state = $1 and b.session_id = $2 and ($3::bigint is null or b.bill_id > $3)
          order by b.bill_id limit ${PAGE}`,
        [state, session, id]);
      return { rows, next: rows.length === PAGE ? [rows[rows.length - 1].bill_id] : null };
    }
    case "sponsors": {
      const [bill, person] = after(2)
      const rows = await q<Row>(
        `select s.bill_id, b.bill_number, s.people_id, p.name, p.party, p.chamber, p.district, s.sponsor_type_id as type, s.position
           from "Sponsors" s join "Bills" b using (bill_id) join "People" p using (people_id)
          where b.state = $1 and b.session_id = $2 and ($3::bigint is null or (s.bill_id, s.people_id) > ($3, $4))
          order by s.bill_id, s.people_id limit ${PAGE}`,
        [state, session, bill, person]);
      const last = rows[rows.length - 1]
      return { rows, next: rows.length === PAGE ? [last.bill_id, last.people_id] : null };
    }
    case "members": {
      const [id] = after(1)
      const rows = await q<Row>(
        `select p.people_id, p.name, p.first_name, p.last_name, p.party, p.role, p.chamber, p.district, p.bioguide_id,
                exists (select 1 from "SessionPeople" sp where sp.people_id = p.people_id and sp.state = $1 and sp.year = $2) as on_roster
           from "People" p
          where p.state = $1 and p.committee_id is null and not coalesce(p.archived, false) and p.role in ('Rep', 'Sen')
            and ($3::bigint is null or p.people_id > $3)
            and (exists (select 1 from "SessionPeople" sp where sp.people_id = p.people_id and sp.state = $1 and sp.year = $2)
                 or exists (select 1 from "Sponsors" s join "Bills" b using (bill_id) where s.people_id = p.people_id and b.state = $1 and b.session_id = $2))
          order by p.people_id limit ${PAGE}`,
        [state, session, id]);
      return { rows, next: rows.length === PAGE ? [rows[rows.length - 1].people_id] : null };
    }
    case "committees": {
      if (cursor) return { rows: [], next: null }
      const rows = await q<Row>(
        `select b.committee, min(b.body) as chamber, count(*)::int as bills
           from "Bills" b where b.state = $1 and b.session_id = $2 and coalesce(b.committee, '') <> ''
          group by 1 order by 1`,
        [state, session]);
      return { rows, next: null };
    }
    case "rollcalls": {
      const [id] = after(1)
      const rows = await q<Row>(
        `select r.roll_call_id, r.bill_id, b.bill_number, r.date, r.chamber, r.description,
                r.yea::int as yea, nullif(r.nay, '')::int as nay, nullif(r.nv, '')::int as nv, nullif(r.absent, '')::int as absent, r.total::int as total
           from "Roll Call" r join "Bills" b using (bill_id)
          where b.state = $1 and b.session_id = $2 and ($3::bigint is null or r.roll_call_id > $3)
          order by r.roll_call_id limit ${PAGE}`,
        [state, session, id]);
      return { rows, next: rows.length === PAGE ? [rows[rows.length - 1].roll_call_id] : null };
    }
    case "votes": {
      // By roll call, a few dozen at a time: "Votes" is indexed by roll call,
      // and a row-value seek across the three-way join was walking the whole
      // table for every page (24,000 rows in nine minutes on Delaware).
      const [roll] = after(1)
      const calls = await q<{ roll_call_id: number }>(
        `select r.roll_call_id from "Roll Call" r join "Bills" b using (bill_id)
          where b.state = $1 and b.session_id = $2 and ($3::bigint is null or r.roll_call_id > $3)
          order by r.roll_call_id limit 40`,
        [state, session, roll]);
      if (!calls.length) return { rows: [], next: null }
      const ids = calls.map((c) => Number(c.roll_call_id))
      const rows = await q<Row>(
        `select v.roll_call_id, v.people_id, v.vote_desc as vote
           from "Votes" v where v.roll_call_id = any($1::bigint[])
          order by v.roll_call_id, v.people_id`,
        [ids]);
      return { rows, next: calls.length === 40 ? [ids[ids.length - 1]] : null };
    }
    case "history": {
      const [bill, seq] = after(2)
      const rows = await q<Row>(
        `select h.bill_id, b.bill_number, h.date, h.chamber, h.action, h.sequence
           from "History Table" h join "Bills" b using (bill_id)
          where b.state = $1 and b.session_id = $2 and ($3::bigint is null or (h.bill_id, h.sequence) > ($3, $4))
          order by h.bill_id, h.sequence limit ${PAGE}`,
        [state, session, bill, seq]);
      const last = rows[rows.length - 1]
      return { rows, next: rows.length === PAGE ? [last.bill_id, last.sequence] : null };
    }
  }
}

/** A CSV cell: quoted when it has to be, RFC 4180. */
const cell = (value: unknown) => {
  if (value === null || value === undefined) return ""
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * The whole family as a stream of text — a JSON array, or CSV with a header
 * row — page by page, so the first bytes leave before the last row is read.
 */
export function datasetStream(family: DatasetFamily, state: string, session: number, format: "json" | "csv") {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let cursor: unknown[] | null = null
      let first = true
      let columns: string[] = []
      if (format === "json") controller.enqueue(encoder.encode("["))
      try {
        do {
          const page: { rows: Row[]; next: unknown[] | null } = await datasetPage(family, state, session, cursor)
          for (const row of page.rows) {
            if (format === "json") {
              controller.enqueue(encoder.encode(`${first ? "\n" : ",\n"}${JSON.stringify(row)}`))
            } else {
              if (first) {
                columns = Object.keys(row)
                controller.enqueue(encoder.encode(columns.join(",") + "\r\n"))
              }
              controller.enqueue(encoder.encode(columns.map((c) => cell(row[c])).join(",") + "\r\n"))
            }
            first = false
          }
          cursor = page.next
        } while (cursor)
        if (format === "json") controller.enqueue(encoder.encode("\n]\n"))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
