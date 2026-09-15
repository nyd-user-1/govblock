import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"

import { readerOf } from "@/lib/entitlements-server"
import { one, q } from "@/lib/policy/db"
import { XML_BUCKET } from "@/lib/policy/expressions"

// The run controls: jobs into the queue the controller on the pipeline box
// reads (scripts/xml/run.mjs --watch), and a job retried, cancelled or moved
// to the front. Mirrors scripts/xml/enqueue.mjs. An admin's.
//
//   POST  { jurisdictions: ["us-ny"], kind: "bill" | "statute", units?: ["2025"], now?: true, again?: true }
//   PATCH { ids: [12, 13], action: "retry" | "cancel" | "front" }

export const dynamic = "force-dynamic"

const PRIORITY = { federalBills: 10, usc: 30, nyStatutes: 40, statutes: 50, stateBills: 60 }
// A state whose "Laws" holds hundreds of separate acts is one job, not hundreds (enqueue.mjs).
const MANY_LAWS = 150
const FIRST_CONGRESS_WITH_XML = 113

const stateOf = (j: string) => (j === "us" ? "US" : j.replace(/^us-/, "").toUpperCase())
const congressOf = (year: number) => Math.floor((year - 1789) / 2) + 1
const refuse = () => NextResponse.json({ error: "The run controls are an admin's." }, { status: 403 })

type Job = { jurisdiction: string; kind: string; unit: string; priority: number; status?: string; reason?: string | null }

async function lakeSessions(state: string) {
  const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" })
  const out = new Set<string>()
  let token: string | undefined
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: XML_BUCKET, Prefix: `lake/v1/text/bill_texts/jurisdiction=${state.toLowerCase()}/`, ContinuationToken: token }))
    for (const o of r.Contents ?? []) {
      const m = /session=(\d+)\//.exec(o.Key ?? "")
      if (m) out.add(m[1])
    }
    token = r.NextContinuationToken
  } while (token)
  return [...out].sort().reverse()
}

async function plan(jurisdiction: string, kind: string, units: string[] | null, now: boolean): Promise<Job[]> {
  const state = stateOf(jurisdiction)
  const jobs: Job[] = []
  if (kind === "bill" && state === "US") {
    const sessions = units ?? (await q<{ session_id: number }>(`select distinct session_id from "Bills" where state = 'US' order by 1 desc`)).map((r) => String(r.session_id))
    for (const unit of sessions) {
      const congress = congressOf(Number(unit))
      if (congress < FIRST_CONGRESS_WITH_XML) jobs.push({ jurisdiction, kind, unit, priority: PRIORITY.federalBills, status: "blocked", reason: `the ${congress}th Congress: GovInfo publishes no bill XML before the ${FIRST_CONGRESS_WITH_XML}th, and "BillTexts" holds no federal text before 2013` })
      else jobs.push({ jurisdiction, kind, unit, priority: PRIORITY.federalBills + (2025 - Number(unit)) / 2 })
    }
  } else if (kind === "bill") {
    for (const unit of units ?? (await lakeSessions(state))) jobs.push({ jurisdiction, kind, unit, priority: PRIORITY.stateBills + (2026 - Number(unit)) })
  } else if (kind === "statute") {
    const laws = units ?? (await q<{ law_id: string }>(`select distinct law_id from "Laws" where state = $1 order by 1`, [state])).map((r) => r.law_id)
    const priority = state === "US" ? PRIORITY.usc : state === "NY" ? PRIORITY.nyStatutes : PRIORITY.statutes
    if (!units && state !== "US" && laws.length > MANY_LAWS) jobs.push({ jurisdiction, kind, unit: "*", priority })
    else for (const unit of laws) jobs.push({ jurisdiction, kind, unit, priority })
  }
  return now ? jobs.map((j) => ({ ...j, priority: Math.min(j.priority, 1) })) : jobs
}

export async function POST(request: Request) {
  const reader = await readerOf(request)
  if (!reader.admin) return refuse()
  const body = (await request.json().catch(() => ({}))) as { jurisdictions?: string[]; kind?: string; units?: string[]; now?: boolean; again?: boolean }
  const jurisdictions = (body.jurisdictions ?? []).map((j) => String(j).toLowerCase()).filter((j) => /^us(-[a-z]{2})?$/.test(j))
  const kind = body.kind === "statute" ? "statute" : body.kind === "bill" ? "bill" : null
  if (!jurisdictions.length || !kind) return NextResponse.json({ error: "name one or more jurisdictions (us, us-ny) and a kind (bill or statute)" }, { status: 400 })
  const units = body.units?.length ? body.units.map(String) : null
  const run = `dashboard-${new Date().toISOString().slice(0, 10)}`
  const by = `dashboard:${(reader as { home?: string | null }).home ?? "admin"}`

  let queued = 0
  let open = 0
  let skipped = 0
  for (const jurisdiction of jurisdictions) {
    for (const job of await plan(jurisdiction, kind, units, !!body.now)) {
      // A unit already built stays built unless the run is asked for again (a rebuild is `again`).
      if (!body.again) {
        const prior = await one(`select id from xml_jobs where jurisdiction = $1 and kind = $2 and unit = $3 and status in ('done', 'blocked')`, [job.jurisdiction, job.kind, job.unit])
        if (prior) {
          skipped++
          continue
        }
      }
      const row = await one(
        `insert into xml_jobs (jurisdiction, kind, unit, priority, status, reason, run, requested_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (jurisdiction, kind, unit) where status in ('queued', 'waiting', 'running') do nothing returning id`,
        [job.jurisdiction, job.kind, job.unit, job.priority, job.status ?? "queued", job.reason ?? null, run, by]
      )
      if (row) queued++
      else open++
    }
  }
  return NextResponse.json({ queued, open, skipped, run })
}

export async function PATCH(request: Request) {
  const reader = await readerOf(request)
  if (!reader.admin) return refuse()
  const body = (await request.json().catch(() => ({}))) as { ids?: number[]; action?: string }
  const ids = (body.ids ?? []).map(Number).filter(Number.isInteger)
  if (!ids.length) return NextResponse.json({ error: "no jobs named" }, { status: 400 })
  const list = ids.join(",")
  const sql =
    body.action === "retry"
      ? `update xml_jobs set status = 'queued', worker = null, error = null, finished_at = null where id = any(string_to_array($1, ',')::bigint[]) and status in ('failed', 'blocked', 'waiting', 'cancelled') returning id`
      : body.action === "cancel"
        ? `update xml_jobs set status = 'cancelled', finished_at = now() where id = any(string_to_array($1, ',')::bigint[]) and status in ('queued', 'waiting') returning id`
        : body.action === "front"
          ? `update xml_jobs set priority = 0 where id = any(string_to_array($1, ',')::bigint[]) and status in ('queued', 'waiting') returning id`
          : null
  if (!sql) return NextResponse.json({ error: "action is retry, cancel or front" }, { status: 400 })
  const rows = await q<{ id: number }>(sql, [list])
  return NextResponse.json({ changed: rows.length })
}
