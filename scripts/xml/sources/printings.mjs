// A state bill's printings, dated and staged: shared by the Parquet reader
// (the backfill) and the Aurora delta reader (the nightly run), so a printing
// gets the same address whichever read it first.
import { sessionSegment, stageSlug, stateBillWork } from "../lib/address.mjs"

/** A legislature's web page stored as the bill: California leginfo's hide-the-page style and frame-busting script. */
export const CAPTURED_PAGE = /\/\*\s*Hide page by default\s*\*\/|window\.top\.location\.replace|<script\b/i

// A document that rides along with a bill but is not a printing of it.
export const NOT_A_PRINTING = /memo|fiscal|analysis|summary|note\b|report|statement|testimony|veto|vote|letter|fetch failed|crs/i

/** The BillHistory action that produced a printing, by what the printing is called. */
function actionFor(name) {
  if (/introduc|original|^(as )?filed|prefiled|first reading/i.test(name)) return /./
  if (/enroll/i.test(name)) return /enroll|passed both|delivered to (the )?governor|sent to (the )?governor/i
  if (/chapter|signed|act\b|public act|session law/i.test(name)) return /chapter|signed|approved by (the )?governor|became law|act no/i
  if (/engross/i.test(name)) return /engross|passed|third reading/i
  return /amend|substitut|print number|reprint|committee substitute|reported/i
}

const isoDay = (v) => {
  if (!v) return null
  const s = v instanceof Date ? v.toISOString() : String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

/**
 * Every printing of one bill, in document order. `docs` are the bill's
 * "BillTexts" rows ({ document_id, version, text?, fetched_at }); a row
 * without text still takes its place in the dating and the staging, so a
 * nightly delta that holds only the new printing's text numbers it the way
 * the backfill did. `actions` is the bill's BillHistory, oldest first.
 *
 * Each printing is dated by the action that produced it, at or after the
 * printing before it; where none matches, it takes that earlier printing's
 * date, and with no history at all the day it was read.
 */
export function* printingsOfBill({ state, unit, bill, docs, actions }) {
  const session = sessionSegment(unit, bill.session_title, bill.legiscan_session_id)
  const work = stateBillWork(state, session, bill.bill_number)
  // A web page captured in place of the bill is never a printing, whatever it
  // is called: California's leginfo pages ("/* Hide page by default*/" and the
  // frame-busting script) did not match the clean feed's version names
  // ("Amended" against "Amended Assembly (v96)"), so the rule below alone kept
  // all 581 of them (window 7, 2026-09-14). Its row still dates the printings
  // around it.
  const printed = docs.filter((t) => !NOT_A_PRINTING.test(String(t.version ?? ""))).map((t) => (t.text && CAPTURED_PAGE.test(String(t.text).slice(0, 4000)) ? { ...t, text: null } : t))
  // The same printing read twice, once from the legislature's web page
  // (state_link) and once from a clean feed (California's pubinfo, New York's
  // Senate API): the web page is dropped.
  const clean = new Set(printed.filter((t) => t.source && t.source !== "state_link").map((t) => String(t.version ?? "").toLowerCase()))
  // California's pubinfo writes a version it cannot yet match to a LegiScan
  // document under a synthetic negative id, and the same version under the
  // real id once the document exists: one printing, kept once, the real id.
  const seen = new Set()
  const list = printed
    .filter((t) => !(t.source === "state_link" && clean.has(String(t.version ?? "").toLowerCase())))
    .sort((a, b) => (Number(b.document_id) > 0) - (Number(a.document_id) > 0) || Math.abs(Number(a.document_id)) - Math.abs(Number(b.document_id)))
    .filter((t) => {
      const v = /\(v\d+\)\s*$/.test(String(t.version ?? "")) ? `${t.source}:${String(t.version).toLowerCase()}` : null
      if (!v) return true
      if (seen.has(v)) return false
      seen.add(v)
      return true
    })
    .sort((a, b) => Math.abs(Number(a.document_id)) - Math.abs(Number(b.document_id)))
  if (!list.length) return
  if (!work) {
    for (const t of list) if (t.text) yield { fallout: { stage: "source", reason: "bill number does not split", detail: String(bill.bill_number), sourceRef: `BillTexts:${t.document_id}` } }
    return
  }
  let floor = null
  const used = new Map()
  for (const t of list) {
    const name = String(t.version ?? "text")
    const lettered = /^amendment\s+([a-z])$/i.exec(name)
    const stageBase = lettered ? lettered[1].toLowerCase() : stageSlug(name)
    let date = null
    let basis = "history"
    const wanted = actionFor(name)
    const hit = actions.find((a) => (!floor || a.date >= floor) && wanted.test(a.action))
    if (hit) date = hit.date
    else if (floor) date = floor
    else if (actions.length) date = actions[0].date
    else {
      date = isoDay(t.fetched_at)
      basis = "fetched"
    }
    if (!date) {
      if (t.text) yield { fallout: { work, stage: "source", reason: "no date", detail: name, sourceRef: `BillTexts:${t.document_id}` } }
      continue
    }
    floor = date
    const key = `${date}_${stageBase}`
    const n = (used.get(key) ?? 0) + 1
    used.set(key, n)
    if (!t.text) continue
    const stage = n > 1 ? `${stageBase}-${n}` : stageBase
    yield {
      work,
      unit: stage,
      session,
      label: String(bill.bill_number),
      sourceUrl: null,
      sourceRef: `BillTexts:${t.document_id}`,
      frontEnd: state.toUpperCase(),
      source: { kind: "text", body: t.text, meta: { kind: "bill" } },
      info: { kind: "bill", root: "bill", stage, number: String(bill.bill_number), title: bill.title ?? null, publisher: null, fidelity: "plain-text", date, dateBasis: basis },
    }
  }
}

/** BillHistory rows → { date, sequence, action }, oldest first, dropping undated ones. */
export function historyList(rows) {
  return rows
    .map((r) => ({ date: isoDay(r.date), sequence: Number(r.sequence ?? 0), action: String(r.action ?? "") }))
    .filter((a) => a.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence)
}
