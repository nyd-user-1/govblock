// A state's bills for one session, from the lake: the printings' text
// (lake/v1/text/bill_texts), the bills they belong to (legislative/bills) and
// the BillHistory that dates them (legislative/history_table). Aurora holds
// the same rows, but reads "BillTexts" at about a row a second over the Data
// API; the Parquet export reads a session in seconds. Printings fetched after
// the export are the next nightly run's (the job definition in window-2.md).
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { BUCKET, sessionSegment, stageSlug, stateBillWork } from "../lib/address.mjs"

const require = createRequire(import.meta.url)
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3")

// hyparquet lives beside the repo on the pipeline box (~/xml-tools) so the
// shared package.json and lockfile stay as they are on the night shift.
const TOOLS = process.env.XML_TOOLS || join(homedir(), "xml-tools")
const toolsRequire = createRequire(join(TOOLS, "package.json"))
const { parquetReadObjects } = await import(pathToFileURL(toolsRequire.resolve("hyparquet")).href)
const { compressors } = await import(pathToFileURL(toolsRequire.resolve("hyparquet-compressors")).href)

const s3 = new S3Client({ region: "us-east-1", maxAttempts: 8 })

async function objects(prefix) {
  const keys = []
  let token
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }))
    for (const o of r.Contents ?? []) if (o.Key.endsWith(".parquet")) keys.push(o.Key)
    token = r.NextContinuationToken
  } while (token)
  return keys
}

async function readParquet(prefix, columns) {
  const out = []
  for (const Key of await objects(prefix)) {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key }))
    const bytes = await r.Body.transformToByteArray()
    const file = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    for (const row of await parquetReadObjects({ file, compressors, columns })) out.push(row)
  }
  return out
}

// BillHistory by jurisdiction, kept for the controller's life: a state's
// sessions run one after another and share the file.
const historyCache = new Map()
async function historyOf(jurisdiction) {
  if (!historyCache.has(jurisdiction)) {
    historyCache.clear()
    const rows = await readParquet(`lake/v1/legislative/history_table/jurisdiction=${jurisdiction}/`, ["bill_id", "date", "sequence", "action"])
    const byBill = new Map()
    for (const r of rows) {
      const id = Number(r.bill_id)
      const date = r.date ? String(r.date instanceof Date ? r.date.toISOString() : r.date).slice(0, 10) : null
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      const list = byBill.get(id) ?? []
      list.push({ date, sequence: Number(r.sequence ?? 0), action: String(r.action ?? "") })
      byBill.set(id, list)
    }
    for (const list of byBill.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.sequence - b.sequence)
    historyCache.set(jurisdiction, byBill)
  }
  return historyCache.get(jurisdiction)
}

// A document that rides along with a bill but is not a printing of it.
const NOT_A_PRINTING = /memo|fiscal|analysis|summary|note\b|report|statement|testimony|veto|vote|letter|fetch failed|crs/i

/** The BillHistory action that produced a printing, by what the printing is called. */
function actionFor(name) {
  if (/introduc|original|^(as )?filed|prefiled|first reading/i.test(name)) return /./
  if (/enroll/i.test(name)) return /enroll|passed both|delivered to (the )?governor|sent to (the )?governor/i
  if (/chapter|signed|act\b|public act|session law/i.test(name)) return /chapter|signed|approved by (the )?governor|became law|act no/i
  if (/engross/i.test(name)) return /engross|passed|third reading/i
  return /amend|substitut|print number|reprint|committee substitute|reported/i
}

/**
 * The job's documents. `unit` is the session's first year. Each printing is
 * dated by the BillHistory action that produced it, at or after the printing
 * before it; where none matches, it takes that earlier printing's date, and
 * only with no history at all the day it was read.
 */
export async function* stateBills({ jurisdiction, unit, log }) {
  const state = jurisdiction.replace(/^us-/, "")
  const t0 = Date.now()
  const [texts, bills] = await Promise.all([
    readParquet(`lake/v1/text/bill_texts/jurisdiction=${state}/session=${unit}/`, ["document_id", "bill_id", "version", "mime", "text", "text_hash", "fetched_at"]),
    readParquet(`lake/v1/legislative/bills/jurisdiction=${state}/session=${unit}/`, ["bill_id", "bill_number", "session_title", "legiscan_session_id", "title"]),
  ])
  const history = await historyOf(state)
  log(`${texts.length.toLocaleString()} documents, ${bills.length.toLocaleString()} bills, history for ${history.size.toLocaleString()} bills, read in ${((Date.now() - t0) / 1000).toFixed(1)} s`)

  const billById = new Map(bills.map((b) => [Number(b.bill_id), b]))
  const byBill = new Map()
  for (const t of texts) {
    const id = Number(t.bill_id)
    const list = byBill.get(id) ?? []
    list.push(t)
    byBill.set(id, list)
  }

  const printings = texts.filter((t) => t.text && !NOT_A_PRINTING.test(String(t.version ?? "")))
  yield { count: printings.length }
  const skipped = texts.length - printings.length
  if (skipped) log(`${skipped.toLocaleString()} documents are not printings (memos, fiscal notes, failed fetches) and are left out`)

  for (const [billId, docs] of byBill) {
    const bill = billById.get(billId)
    const list = docs.filter((t) => t.text && !NOT_A_PRINTING.test(String(t.version ?? ""))).sort((a, b) => Math.abs(Number(a.document_id)) - Math.abs(Number(b.document_id)))
    if (!list.length) continue
    if (!bill) {
      for (const t of list) yield { fallout: { stage: "source", reason: "printing with no bill in the lake", detail: `bill_id ${billId}`, sourceRef: `BillTexts:${t.document_id}` } }
      continue
    }
    const session = sessionSegment(unit, bill.session_title, bill.legiscan_session_id)
    const work = stateBillWork(state, session, bill.bill_number)
    if (!work) {
      for (const t of list) yield { fallout: { stage: "source", reason: "bill number does not split", detail: String(bill.bill_number), sourceRef: `BillTexts:${t.document_id}` } }
      continue
    }
    const actions = history.get(billId) ?? []
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
        date = t.fetched_at ? new Date(t.fetched_at).toISOString().slice(0, 10) : null
        basis = "fetched"
      }
      if (!date) {
        yield { fallout: { work, stage: "source", reason: "no date", detail: name, sourceRef: `BillTexts:${t.document_id}` } }
        continue
      }
      floor = date
      const key = `${date}_${stageBase}`
      const n = (used.get(key) ?? 0) + 1
      used.set(key, n)
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
}
