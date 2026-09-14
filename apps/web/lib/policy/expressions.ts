import "server-only"

import { gunzipSync } from "node:zlib"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { n, one, q } from "@/lib/policy/db"

// The legislative XML store (sql/005_expressions.sql): one USLM document per
// Expression in S3, one row per document in `expressions`. The address is
// work || '@' || expression (docs/xml/schema.md); the documents are written by
// scripts/xml/run.mjs on the pipeline box and read here.

export const XML_BUCKET = "govblock-lake-638175140432"

export type ExpressionRow = {
  work: string
  expression: string
  expression_date: string
  date_basis: string | null
  kind: string
  jurisdiction: string
  session: string | null
  unit: string
  label: string | null
  fidelity: string
  coverage: number | null
  dialect: string | null
  front_end: string
  builder: number
  source_url: string | null
  source_ref: string | null
  s3_key: string
  content_hash: string
  bytes: number
  gz_bytes: number
  built_at: string
}

const COLUMNS = `work, expression, expression_date::text as expression_date, date_basis, kind, jurisdiction, session, unit, label, fidelity, coverage,
  dialect, front_end, builder, source_url, source_ref, s3_key, content_hash, bytes, gz_bytes, built_at::text as built_at`

/** "/us/bill/119/hr/6644@2025-12-11_ih.xml" → its parts. The format is optional; so is the expression. */
export function splitAddress(address: string): { work: string; expression: string | null; format: string | null } | null {
  const m = /^(\/[a-z]{2}(?:-[a-z]{2})?\/[a-z]+\/[A-Za-z0-9./-]+?)(?:@([0-9]{4}-[0-9]{2}-[0-9]{2}(?:_[A-Za-z0-9.-]+)?))?(?:\.(xml|html|md|txt|pdf|json))?$/.exec(address)
  return m ? { work: m[1], expression: m[2] ?? null, format: m[3] ?? null } : null
}

/**
 * The Expression in force on a date: the Work's row with the greatest date on
 * or before it. Two printings of a bill on one date are ordered by their stage,
 * the later letter or suffix last; with no date, the Work's latest.
 */
export async function expressionAt(work: string, date?: string | null): Promise<ExpressionRow | null> {
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return one<ExpressionRow>(
    `select ${COLUMNS} from expressions
      where work = $1 and ($2::date is null or expression_date <= $2::date)
      order by expression_date desc, unit desc, built_at desc limit 1`,
    [work, date ?? null]
  )
}

/** One Expression by its address. */
export const expressionOf = (work: string, expression: string) =>
  one<ExpressionRow>(`select ${COLUMNS} from expressions where work = $1 and expression = $2`, [work, expression])

/** A Work's DocHistory: every Expression, oldest first. */
export const expressionsOf = (work: string) =>
  q<ExpressionRow>(`select ${COLUMNS} from expressions where work = $1 order by expression_date, unit`, [work])

let s3: S3Client | null = null

/** The stored USLM, unzipped. */
export async function readUslm(row: Pick<ExpressionRow, "s3_key">): Promise<string> {
  s3 ??= new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" })
  const object = await s3.send(new GetObjectCommand({ Bucket: XML_BUCKET, Key: row.s3_key }))
  const bytes = Buffer.from(await object.Body!.transformToByteArray())
  // S3 hands the body back as stored; a gzip header means it is still compressed.
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8")
}

// ------------------------------------------------------------- dashboard ---

export type StoreLine = { jurisdiction: string; kind: string; expressions: number; works: number; sessions: number; gz_bytes: number; coverage: number | null; native: number; last_built: string | null }
export type SessionLine = { jurisdiction: string; session: string; expressions: number; works: number; coverage: number | null }
export type JobLine = {
  id: number
  jurisdiction: string
  kind: string
  unit: string
  status: string
  priority: number
  reason: string | null
  total: number | null
  built: number
  unchanged: number
  fell_out: number
  coverage: number | null
  bytes: number
  worker: string | null
  run: string | null
  error: string | null
  created_at: string
  started_at: string | null
  heartbeat_at: string | null
  finished_at: string | null
}
export type QueueLine = { jurisdiction: string; kind: string; status: string; jobs: number; built: number; fell_out: number }
export type FalloutLine = { jurisdiction: string; stage: string; reason: string; samples: number; example: string | null }
export type RateLine = { minutes: number; built: number }

export type PipelineStatus = {
  totals: { expressions: number; works: number; gz_bytes: number; jurisdictions: number }
  store: StoreLine[]
  sessions: SessionLine[]
  queue: QueueLine[]
  running: JobLine[]
  recent: JobLine[]
  attention: JobLine[]
  fallouts: FalloutLine[]
  rates: RateLine[]
  runs: { run: string; jobs: number; done: number; failed: number; built: number; fell_out: number; started: string | null; finished: string | null }[]
  at: string
}

const JOB_COLUMNS = `id, jurisdiction, kind, unit, status, priority, reason, total, built, unchanged, fell_out, coverage, bytes, worker, run, error,
  created_at::text as created_at, started_at::text as started_at, heartbeat_at::text as heartbeat_at, finished_at::text as finished_at`

/** Everything the Ingestion page draws, in one round of reads. */
export async function pipelineStatus(): Promise<PipelineStatus> {
  const [store, sessions, queue, running, recent, attention, fallouts, rates, runs] = await Promise.all([
    q<StoreLine>(
      `select jurisdiction, kind, count(*)::int as expressions, count(distinct work)::int as works, count(distinct session)::int as sessions,
              sum(gz_bytes)::bigint as gz_bytes, avg(coverage)::real as coverage, count(*) filter (where fidelity = 'native-xml')::int as native,
              max(built_at)::text as last_built
         from expressions group by 1, 2 order by 1, 2`
    ),
    q<SessionLine>(
      `select jurisdiction, session, count(*)::int as expressions, count(distinct work)::int as works, avg(coverage)::real as coverage
         from expressions where kind = 'bill' group by 1, 2 order by 1, 2 desc`
    ),
    q<QueueLine>(`select jurisdiction, kind, status, count(*)::int as jobs, sum(built)::int as built, sum(fell_out)::int as fell_out from xml_jobs group by 1, 2, 3 order by 1, 2, 3`),
    q<JobLine>(`select ${JOB_COLUMNS} from xml_jobs where status = 'running' order by started_at`),
    q<JobLine>(`select ${JOB_COLUMNS} from xml_jobs where status in ('done', 'failed', 'blocked') order by coalesce(finished_at, created_at) desc limit 40`),
    q<JobLine>(`select ${JOB_COLUMNS} from xml_jobs where status in ('failed', 'blocked', 'waiting') order by status, jurisdiction, unit limit 200`),
    q<FalloutLine>(
      `select jurisdiction, stage, reason, count(*)::int as samples, min(coalesce(work, source_ref)) as example
         from xml_fallouts group by 1, 2, 3 order by samples desc limit 60`
    ),
    q<RateLine>(
      `select m as minutes, (select count(*)::int from expressions where built_at > now() - make_interval(mins => m)) as built
         from unnest(array[5, 15, 60]) as m`
    ),
    q<PipelineStatus["runs"][number]>(
      `select run, count(*)::int as jobs, count(*) filter (where status = 'done')::int as done, count(*) filter (where status = 'failed')::int as failed,
              sum(built)::int as built, sum(fell_out)::int as fell_out, min(started_at)::text as started, max(finished_at)::text as finished
         from xml_jobs where run is not null group by run order by min(created_at) desc limit 10`
    ),
  ])
  const totals = await one<{ expressions: number; works: number; gz_bytes: number; jurisdictions: number }>(
    `select count(*)::int as expressions, count(distinct work)::int as works, coalesce(sum(gz_bytes), 0)::bigint as gz_bytes, count(distinct jurisdiction)::int as jurisdictions from expressions`
  )
  const num = <T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]) => rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, r[k] === null ? null : n(r[k])])) }))
  return {
    totals: { expressions: n(totals?.expressions), works: n(totals?.works), gz_bytes: n(totals?.gz_bytes), jurisdictions: n(totals?.jurisdictions) },
    store: num(store, ["expressions", "works", "sessions", "gz_bytes", "native"]),
    sessions: num(sessions, ["expressions", "works"]),
    queue: num(queue, ["jobs", "built", "fell_out"]),
    running,
    recent,
    attention,
    fallouts,
    rates: num(rates, ["minutes", "built"]),
    runs,
    at: new Date().toISOString(),
  }
}
