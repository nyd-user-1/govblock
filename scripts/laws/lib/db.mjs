// Aurora, over the RDS Data API, for the law loaders. Same cluster and the
// same credentials apps/web reads; the loaders never open a Postgres socket,
// so no VPC attachment and no pool.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { RDSDataClient, ExecuteStatementCommand, BatchExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand, RollbackTransactionCommand } = require("@aws-sdk/client-rds-data")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
export const WEB = join(ROOT, "apps/web")

export const env = Object.fromEntries(
  readFileSync(join(WEB, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
)

const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })
const base = { resourceArn: env.POLICY_CLUSTER_ARN, secretArn: env.POLICY_SECRET_ARN, database: env.POLICY_DATABASE || "policy" }

// Aurora Serverless v2 pauses at 0 ACU after five idle minutes and answers the
// first statements with DatabaseResumingException while it wakes (~20 s). A
// long load also meets the odd throttle. Both are waited out rather than
// thrown, which is what makes an overnight run survive the night.
async function send(command, attempts = 30) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.send(command)
    } catch (error) {
      const message = String(error?.name ?? "") + " " + String(error?.message ?? error)
      const transient = /Resuming|resuming after being auto-paused|Throttl|TooManyRequests|ServiceUnavailable|StatementTimeout|timed out|ECONNRESET|EPIPE/i.test(message)
      if (!transient || attempt >= attempts) throw error
      await new Promise((r) => setTimeout(r, Math.min(15000, 2000 + attempt * 1000)))
    }
  }
}

const field = (value) => {
  if (value === null || value === undefined) return { isNull: true }
  if (typeof value === "boolean") return { booleanValue: value }
  if (typeof value === "number") return Number.isInteger(value) ? { longValue: value } : { doubleValue: value }
  return { stringValue: String(value) }
}

const decode = (f) => (f?.isNull ? null : (f?.stringValue ?? f?.longValue ?? f?.doubleValue ?? f?.booleanValue ?? null))

/** A read. `$1` style placeholders, as the app's own queries are written. */
export async function q(text, params = []) {
  const sql = text.replace(/\$(\d+)/g, (_, i) => `:p${Number(i) - 1}`)
  const response = await send(
    new ExecuteStatementCommand({
      ...base,
      sql,
      parameters: params.map((value, i) => ({ name: `p${i}`, value: field(value) })),
      includeResultMetadata: true,
      continueAfterTimeout: true,
    })
  )
  const columns = response.columnMetadata ?? []
  return (response.records ?? []).map((record) => Object.fromEntries(record.map((f, i) => [columns[i]?.name ?? `c${i}`, decode(f)])))
}

export async function one(text, params = []) {
  return (await q(text, params))[0] ?? null
}

export async function exec(sql, params = [], transactionId) {
  return send(
    new ExecuteStatementCommand({
      ...base,
      sql: sql.replace(/\$(\d+)/g, (_, i) => `:p${Number(i) - 1}`),
      parameters: params.map((value, i) => ({ name: `p${i}`, value: field(value) })),
      continueAfterTimeout: true,
      ...(transactionId ? { transactionId } : {}),
    })
  )
}

export const COLUMNS = [
  "state",
  "law_id",
  "law_name",
  "law_type",
  "chapter",
  "location_id",
  "doc_type",
  "doc_level_id",
  "title",
  "parent_location_id",
  "sequence_no",
  "depth",
  "active_date",
  "repealed_date",
  "repealed",
  "text",
]

const INSERT = `insert into "Laws" (${COLUMNS.map((c) => `"${c}"`).join(", ")}, fetched_at)
  values (${COLUMNS.map((c) => (c === "active_date" || c === "repealed_date" ? `:${c}::date` : `:${c}`)).join(", ")}, now())
  on conflict (state, law_id, location_id) do update set
    law_name = excluded.law_name, law_type = excluded.law_type, chapter = excluded.chapter,
    doc_type = excluded.doc_type, doc_level_id = excluded.doc_level_id, title = excluded.title,
    parent_location_id = excluded.parent_location_id, sequence_no = excluded.sequence_no, depth = excluded.depth,
    active_date = excluded.active_date, repealed_date = excluded.repealed_date, repealed = excluded.repealed,
    text = excluded.text, fetched_at = now()`

// The Data API caps a request; a section of law can run to tens of kilobytes,
// so a batch is cut by its own weight rather than by a fixed row count.
const MAX_BYTES = 400_000
const MAX_ROWS = 100

/** Write rows, upserting on (state, law_id, location_id). Returns how many were written. */
export async function writeRows(rows, transactionId) {
  let written = 0
  let batch = []
  let bytes = 0
  const flush = async () => {
    if (!batch.length) return
    await send(
      new BatchExecuteStatementCommand({
        ...base,
        sql: INSERT,
        parameterSets: batch.map((row) => COLUMNS.map((c) => ({ name: c, value: field(row[c] ?? null) }))),
        ...(transactionId ? { transactionId } : {}),
      })
    )
    written += batch.length
    batch = []
    bytes = 0
  }
  for (const row of rows) {
    const weight = (row.text?.length ?? 0) + (row.title?.length ?? 0) + 300
    if (batch.length && (bytes + weight > MAX_BYTES || batch.length >= MAX_ROWS)) await flush()
    batch.push(row)
    bytes += weight
  }
  await flush()
  return written
}

export async function begin() {
  const r = await send(new BeginTransactionCommand(base))
  return r.transactionId
}

export async function commit(transactionId) {
  await send(new CommitTransactionCommand({ ...base, transactionId }))
}

export async function rollback(transactionId) {
  try {
    await send(new RollbackTransactionCommand({ ...base, transactionId }), 3)
  } catch {
    // A transaction that already died takes its rows with it; nothing to undo.
  }
}
