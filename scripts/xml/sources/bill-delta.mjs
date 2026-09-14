// The nightly run's state bills: the printings "BillTexts" gained since the
// last run, read from Aurora (the lake's Parquet is the backfill's, and it
// ages). A night is the text delta's 1,500-document cap at most, so the Data
// API's slow text reads are affordable here: ids first in one scan, then the
// text two dozen at a time, then each touched bill's whole printing list and
// BillHistory, so a new printing is dated and staged the way the backfill
// would have.
//
// The job's unit is "delta@<ISO time>": the jurisdiction's printings fetched after it.
import { q } from "../../laws/lib/db.mjs"
import { historyList, NOT_A_PRINTING, printingsOfBill } from "./printings.mjs"

const inList = (ids) => ids.map(Number).filter(Number.isFinite).join(",")

export async function* billDelta({ jurisdiction, unit, log }) {
  const state = jurisdiction.replace(/^us-/, "").toUpperCase()
  const since = unit.replace(/^delta@/, "")
  if (Number.isNaN(Date.parse(since))) throw Object.assign(new Error(`unit ${unit} names no time`), { blocked: true })

  const changed = await q(`select document_id, bill_id, version from "BillTexts" where state = $1 and fetched_at > $2::timestamptz and text is not null`, [state, since])
  const printings = changed.filter((r) => !NOT_A_PRINTING.test(String(r.version ?? "")))
  yield { count: printings.length }
  log(`${printings.length.toLocaleString()} printings fetched since ${since}`)
  if (!printings.length) return

  const texts = new Map()
  for (let i = 0; i < printings.length; i += 25) {
    const rows = await q(`select document_id, text from "BillTexts" where document_id = any(string_to_array($1, ',')::bigint[])`, [inList(printings.slice(i, i + 25).map((r) => r.document_id))])
    for (const r of rows) texts.set(Number(r.document_id), r.text)
  }

  const billIds = [...new Set(printings.map((r) => Number(r.bill_id)))]
  for (let i = 0; i < billIds.length; i += 200) {
    const ids = inList(billIds.slice(i, i + 200))
    const [bills, docs, history] = await Promise.all([
      q(`select bill_id, session_id, bill_number, session_title, legiscan_session_id, title from "Bills" where bill_id = any(string_to_array($1, ',')::bigint[])`, [ids]),
      q(`select document_id, bill_id, version, fetched_at::text as fetched_at from "BillTexts" where bill_id = any(string_to_array($1, ',')::bigint[])`, [ids]),
      q(`select bill_id, date::text as date, sequence, action from "History Table" where bill_id = any(string_to_array($1, ',')::bigint[])`, [ids]),
    ])
    const docsOf = new Map()
    for (const d of docs) {
      const list = docsOf.get(Number(d.bill_id)) ?? []
      list.push({ ...d, text: texts.get(Number(d.document_id)) ?? null })
      docsOf.set(Number(d.bill_id), list)
    }
    const historyOf = new Map()
    for (const h of history) {
      const list = historyOf.get(Number(h.bill_id)) ?? []
      list.push(h)
      historyOf.set(Number(h.bill_id), list)
    }
    for (const bill of bills) {
      yield* printingsOfBill({ state, unit: String(bill.session_id), bill, docs: docsOf.get(Number(bill.bill_id)) ?? [], actions: historyList(historyOf.get(Number(bill.bill_id)) ?? []) })
    }
  }
}
