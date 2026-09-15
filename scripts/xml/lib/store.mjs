// The index and the queue, over the Data API: `expressions` rows written in
// batches of a thousand (1,837 rows/s measured, one stream), the job a
// controller holds, its heartbeat and its fall-outs. The documents themselves
// go to S3 from the worker threads; nothing here moves a document body.
import { createRequire } from "node:module"
import { hostname } from "node:os"

import { env, exec, one, q } from "../../laws/lib/db.mjs"

const require = createRequire(import.meta.url)
const { RDSDataClient, BatchExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })
const base = { resourceArn: env.POLICY_CLUSTER_ARN, secretArn: env.POLICY_SECRET_ARN, database: env.POLICY_DATABASE || "policy" }

export const WORKER = `${hostname()}:${process.pid}`

async function send(command, attempts = 30) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.send(command)
    } catch (error) {
      const message = `${error?.name ?? ""} ${error?.message ?? error}`
      if (!/Resuming|auto-paused|Throttl|TooManyRequests|ServiceUnavailable|StatementTimeout|timed out|ECONNRESET|EPIPE|socket hang up/i.test(message) || attempt >= attempts) throw error
      await new Promise((r) => setTimeout(r, Math.min(15000, 2000 + attempt * 1000)))
    }
  }
}

const field = (value) => {
  if (value === null || value === undefined) return { isNull: true }
  if (typeof value === "number") return Number.isInteger(value) ? { longValue: value } : { doubleValue: value }
  return { stringValue: String(value) }
}

// ------------------------------------------------------------ expressions ---

const COLUMNS = [
  "work", "expression", "expression_date", "date_basis", "kind", "jurisdiction", "session", "unit", "label", "fidelity",
  "coverage", "dialect", "front_end", "builder", "source_url", "source_ref", "s3_key", "source_hash", "content_hash",
  "bytes", "gz_bytes", "job_id",
]
const VALUES = COLUMNS.map((c) => (c === "expression_date" ? `:${c}::date` : c === "coverage" ? `:${c}::real` : `:${c}`))
const UPSERT = `insert into expressions (${COLUMNS.join(", ")}) values (${VALUES.join(", ")})
  on conflict (work, expression) do update set
    ${COLUMNS.filter((c) => c !== "work" && c !== "expression").map((c) => `${c} = excluded.${c}`).join(", ")},
    built_at = now(), seen_at = now()`

/**
 * Index rows, buffered and flushed a thousand at a time. `flush()` before a
 * job is marked done. A batch the database refuses is written row by row, so
 * one bad row costs itself (`onBad`) and not the other 999.
 */
export function indexWriter({ size = 1000, onBad = () => {} } = {}) {
  let rows = []
  let chain = Promise.resolve()
  let written = 0
  let backlog = 0
  const params = (r) => COLUMNS.map((c) => ({ name: c, value: field(r[c]) }))
  const flushNow = async (batch) => {
    backlog--
    try {
      await send(new BatchExecuteStatementCommand({ ...base, sql: UPSERT, parameterSets: batch.map(params) }))
      written += batch.length
    } catch (error) {
      for (const r of batch) {
        try {
          await send(new BatchExecuteStatementCommand({ ...base, sql: UPSERT, parameterSets: [params(r)] }))
          written++
        } catch (e) {
          onBad(r, e)
        }
      }
    }
  }
  return {
    add(row) {
      rows.push(row)
      if (rows.length >= size) {
        const batch = rows
        rows = []
        backlog++
        chain = chain.then(() => flushNow(batch))
        return chain
      }
      return null
    },
    async flush() {
      if (rows.length) {
        const batch = rows
        rows = []
        backlog++
        chain = chain.then(() => flushNow(batch))
      }
      await chain
      return written
    },
    get written() {
      return written
    },
    /** Batches cut and not yet sent. */
    get backlog() {
      return backlog
    },
  }
}

/** Seen again, unchanged: `seen_at` only. */
export async function touch(works) {
  // Two thousand addresses a statement, as two arrays: a thousand single-row
  // updates took a Congress's 21,640 unchanged printings over two minutes.
  const SEP = String.fromCharCode(31)
  for (let i = 0; i < works.length; i += 2000) {
    const batch = works.slice(i, i + 2000)
    await exec(
      `update expressions e set seen_at = now()
         from unnest(string_to_array($1, chr(31)), string_to_array($2, chr(31))) as t(work, expression)
        where e.work = t.work and e.expression = t.expression`,
      [batch.map(([w]) => w).join(SEP), batch.map(([, e]) => e).join(SEP)]
    )
  }
}

/**
 * What the index already holds under a Work prefix: work → [{ expression, unit,
 * date, source_hash, builder, front_end }], newest first. Paged by id so no
 * response nears the Data API's megabyte.
 */
export async function holdings({ jurisdiction, kind, prefixes }) {
  const out = new Map()
  const within = (work) => prefixes.some((p) => work.startsWith(p))
  let after = 0
  for (;;) {
    // By jurisdiction and kind on (jurisdiction, kind, id); the prefix is checked here, since a
    // LIKE on `work` cannot use the address index under the cluster's collation.
    const rows = await q(
      `select id, work, expression, unit, expression_date::text as date, source_hash, builder, front_end from expressions where jurisdiction = $1 and kind = $2 and id > $3 order by jurisdiction, kind, id limit 5000`,
      [jurisdiction, kind, after]
    )
    for (const r of rows) {
      if (!within(r.work)) continue
      const list = out.get(r.work) ?? []
      list.push(r)
      out.set(r.work, list)
    }
    if (rows.length < 5000) break
    after = rows[rows.length - 1].id
  }
  for (const list of out.values()) list.sort((a, b) => b.date.localeCompare(a.date))
  return out
}

// -------------------------------------------------------------------- jobs ---

/** Jobs whose controller stopped answering go back in the queue. */
export async function reclaimStale(minutes = 10) {
  const r = await exec(`update xml_jobs set status = 'queued', worker = null, error = 'reclaimed: heartbeat stopped' where status = 'running' and heartbeat_at < now() - make_interval(mins => $1::int)`, [minutes])
  return r.numberOfRecordsUpdated ?? 0
}

/** The next queued job, taken. `only` narrows to jurisdictions or a kind. */
export async function claim({ jurisdictions = null, kind = null, run = null } = {}) {
  const where = ["status = 'queued'"]
  const params = [WORKER]
  if (run) {
    params.push(`${run.replace(/[%_]/g, "\\$&")}%`)
    where.push(`run like $${params.length}`)
  }
  if (jurisdictions?.length) {
    params.push(jurisdictions.join(","))
    where.push(`jurisdiction = any(string_to_array($${params.length}, ','))`)
  }
  if (kind) {
    params.push(kind)
    where.push(`kind = $${params.length}`)
  }
  return one(
    `update xml_jobs set status = 'running', worker = $1, started_at = now(), heartbeat_at = now(), finished_at = null, error = null,
       built = 0, unchanged = 0, fell_out = 0, bytes = 0, total = null, coverage = null
     where id = (select id from xml_jobs where ${where.join(" and ")} order by priority, id limit 1 for update skip locked)
     returning *`,
    params
  )
}

export async function heartbeat(job, counts) {
  await exec(
    `update xml_jobs set heartbeat_at = now(), total = $2, built = $3, unchanged = $4, fell_out = $5, bytes = $6, coverage = $7::real where id = $1 and worker = $8`,
    [job.id, counts.total ?? null, counts.built, counts.unchanged, counts.fellOut, counts.bytes, counts.coverage ?? null, WORKER]
  )
}

export async function finish(job, counts, status = "done", error = null) {
  await exec(
    `update xml_jobs set status = $2, finished_at = now(), heartbeat_at = now(), total = $3, built = $4, unchanged = $5, fell_out = $6, bytes = $7, coverage = $8::real, error = $9 where id = $1`,
    [job.id, status, counts.total ?? null, counts.built, counts.unchanged, counts.fellOut, counts.bytes, counts.coverage ?? null, error]
  )
}

/** A job, queued unless one is already open for the same unit. */
export async function enqueue({ jurisdiction, kind, unit, priority = 100, status = "queued", reason = null, run = null, requestedBy = null }) {
  // A blocked unit stays one row: the open-job index does not cover 'blocked'.
  if (status === "blocked" && (await one(`select id from xml_jobs where jurisdiction = $1 and kind = $2 and unit = $3 and status = 'blocked'`, [jurisdiction, kind, String(unit)]))) return null
  return one(
    `insert into xml_jobs (jurisdiction, kind, unit, priority, status, reason, run, requested_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (jurisdiction, kind, unit) where status in ('queued', 'waiting', 'running') do nothing returning id`,
    [jurisdiction, kind, String(unit), priority, status, reason, run, requestedBy]
  )
}

// --------------------------------------------------------------- fall-outs ---

/** The first fifty of each reason per job are kept; the count is on the job. */
export function falloutLog(job) {
  const seen = new Map()
  let rows = []
  const write = async () => {
    if (!rows.length) return
    const batch = rows
    rows = []
    await send(
      new BatchExecuteStatementCommand({
        ...base,
        sql: `insert into xml_fallouts (job_id, jurisdiction, work, source_ref, stage, reason, detail) values (:job, :j, :work, :ref, :stage, :reason, :detail)`,
        parameterSets: batch.map((r) => [
          { name: "job", value: field(job.id) }, { name: "j", value: field(job.jurisdiction) }, { name: "work", value: field(r.work) },
          { name: "ref", value: field(r.sourceRef) }, { name: "stage", value: field(r.stage) }, { name: "reason", value: field(r.reason) }, { name: "detail", value: field(r.detail) },
        ]),
      })
    )
  }
  return {
    add(r) {
      const n = (seen.get(r.reason) ?? 0) + 1
      seen.set(r.reason, n)
      if (n <= 50) rows.push(r)
      if (rows.length >= 200) return write()
      return null
    },
    flush: write,
    reasons: seen,
  }
}
