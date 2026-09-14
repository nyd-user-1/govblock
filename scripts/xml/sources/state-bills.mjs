// A state's bills for one session, from the lake: the printings' text
// (lake/v1/text/bill_texts), the bills they belong to (legislative/bills) and
// the BillHistory that dates them (legislative/history_table). Aurora holds
// the same rows, but reads "BillTexts" at about a row a second over the Data
// API; the Parquet export reads a session in seconds. Printings fetched after
// the export are the nightly run's (bill-delta.mjs).
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { BUCKET } from "../lib/address.mjs"
import { historyList, NOT_A_PRINTING, printingsOfBill } from "./printings.mjs"

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

// BillHistory by jurisdiction, the last eight kept: the queue runs every
// state's newest session before anyone's older one, so a controller moves
// between states job by job and would otherwise read a history file each time.
const historyCache = new Map()
async function historyOf(jurisdiction) {
  if (historyCache.has(jurisdiction)) {
    const hit = historyCache.get(jurisdiction)
    historyCache.delete(jurisdiction)
    historyCache.set(jurisdiction, hit)
  } else {
    if (historyCache.size >= 8) historyCache.delete(historyCache.keys().next().value)
    const rows = await readParquet(`lake/v1/legislative/history_table/jurisdiction=${jurisdiction}/`, ["bill_id", "date", "sequence", "action"])
    const byBill = new Map()
    for (const r of rows) {
      const id = Number(r.bill_id)
      const list = byBill.get(id) ?? []
      list.push(r)
      byBill.set(id, list)
    }
    for (const [id, list] of byBill) byBill.set(id, historyList(list))
    historyCache.set(jurisdiction, byBill)
  }
  return historyCache.get(jurisdiction)
}

/** The job's documents. `unit` is the session's first year. */
export async function* stateBills({ jurisdiction, unit, log }) {
  const state = jurisdiction.replace(/^us-/, "")
  const t0 = Date.now()
  const [texts, bills] = await Promise.all([
    readParquet(`lake/v1/text/bill_texts/jurisdiction=${state}/session=${unit}/`, ["document_id", "bill_id", "version", "text", "fetched_at"]),
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
    if (!bill) {
      for (const t of docs) if (t.text && !NOT_A_PRINTING.test(String(t.version ?? ""))) yield { fallout: { stage: "source", reason: "printing with no bill in the lake", detail: `bill_id ${billId}`, sourceRef: `BillTexts:${t.document_id}` } }
      continue
    }
    yield* printingsOfBill({ state, unit, bill, docs, actions: history.get(billId) ?? [] })
  }
}
