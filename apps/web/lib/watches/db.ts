import "server-only"

import { one, q } from "@/lib/policy/db"
import type { Step, Trigger } from "@/lib/watches/templates"

// What the site reads and writes about watches. The engine that runs them
// is livingston/scripts/watches; this file only ever touches the watches
// table, the runs, and the deliveries, all scoped to one reader's id.

export type Watch = {
  id: string
  user_id: string
  owner: { email?: string; name?: string }
  name: string
  template: string | null
  trigger: Trigger
  steps: Step[]
  enabled: boolean
  last_fired_at: string | null
  created_at: string
  updated_at: string
  runs?: number
  last_run_at?: string | null
  waiting?: number
}
export type Run = {
  id: string
  watch_id: string
  status: string
  step: number
  wake_at: string | null
  attempts: number
  last_error: string | null
  started_at: string
  updated_at: string
  finished_at: string | null
  subject?: string | null
  steps: Step[]
  context?: Record<string, unknown>
}
export type Delivery = {
  id: number
  run_id: string | null
  watch_id: string | null
  via: string
  to_addr: string | null
  subject: string | null
  body: string | null
  status: string
  error: string | null
  at: string
  read_at: string | null
  watch_name?: string | null
}

const rid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export async function listWatches(userId: string) {
  return q<Watch>(
    `select w.*, (select count(*)::int from watch_runs r where r.watch_id = w.id) as runs,
            (select max(r.started_at) from watch_runs r where r.watch_id = w.id) as last_run_at,
            (select count(*)::int from watch_runs r where r.watch_id = w.id and r.status = 'waiting_approval') as waiting
     from watches w where w.user_id = $1 order by w.updated_at desc`,
    [userId]
  )
}

export async function getWatch(userId: string, id: string) {
  return one<Watch>(`select * from watches where id = $1 and user_id = $2`, [id, userId])
}

export async function createWatch(userId: string, owner: { email?: string | null; name?: string | null }, input: { name: string; template?: string | null; trigger: Trigger; steps: Step[]; enabled?: boolean }) {
  const id = rid("w")
  await q(`insert into watches (id, user_id, owner, name, template, trigger, steps, enabled) values ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::jsonb, $8)`, [
    id,
    userId,
    JSON.stringify({ email: owner.email ?? null, name: owner.name ?? null }),
    input.name,
    input.template ?? null,
    JSON.stringify(input.trigger),
    JSON.stringify(input.steps),
    input.enabled ?? true,
  ])
  return id
}

export async function updateWatch(userId: string, id: string, patch: { name?: string; enabled?: boolean; trigger?: Trigger; steps?: Step[] }) {
  await q(`update watches set name = coalesce($3, name), enabled = coalesce($4, enabled), trigger = coalesce($5::jsonb, trigger), steps = coalesce($6::jsonb, steps), updated_at = now() where id = $1 and user_id = $2`, [
    id,
    userId,
    patch.name ?? null,
    patch.enabled ?? null,
    patch.trigger ? JSON.stringify(patch.trigger) : null,
    patch.steps ? JSON.stringify(patch.steps) : null,
  ])
}

export async function deleteWatch(userId: string, id: string) {
  await q(`delete from watches where id = $1 and user_id = $2`, [id, userId])
}

export async function listRuns(userId: string, watchId?: string, limit = 50) {
  const params: unknown[] = [userId, limit]
  const filter = watchId ? `and r.watch_id = $${params.push(watchId)}` : ""
  return q<Run>(
    `select r.id, r.watch_id, r.status, r.step, r.wake_at, r.attempts, r.last_error, r.started_at, r.updated_at, r.finished_at, r.steps,
            (select d.subject from watch_deliveries d where d.run_id = r.id order by d.id desc limit 1) as subject
     from watch_runs r where r.user_id = $1 ${filter} order by r.started_at desc limit $2`,
    params
  )
}

export async function getRun(userId: string, id: string) {
  return one<Run>(`select * from watch_runs where id = $1 and user_id = $2`, [id, userId])
}

export async function listDeliveries(userId: string, limit = 100) {
  return q<Delivery>(
    `select d.id, d.run_id, d.watch_id, d.via, d.to_addr, d.subject, d.body, d.status, d.error, d.at, d.read_at, w.name as watch_name
     from watch_deliveries d left join watches w on w.id = d.watch_id where d.user_id = $1 order by d.at desc limit $2`,
    [userId, limit]
  )
}

export async function markRead(userId: string, id: number) {
  await q(`update watch_deliveries set read_at = coalesce(read_at, now()) where id = $1 and user_id = $2`, [id, userId])
}

/** The reader answers an approval: the run wakes with the answer, and the inbox item records it. */
export async function answerApproval(userId: string, deliveryId: number, approved: boolean) {
  const d = await one<{ run_id: string; status: string }>(`select run_id, status from watch_deliveries where id = $1 and user_id = $2 and via = 'approval'`, [deliveryId, userId])
  if (!d || d.status !== "waiting") return false
  await q(`update watch_deliveries set status = $3, read_at = now() where id = $1 and user_id = $2`, [deliveryId, userId, approved ? "approved" : "declined"])
  await q(`update watch_runs set context = context || $3::jsonb, status = 'running', wake_at = null, updated_at = now() where id = $1 and user_id = $2 and status = 'waiting_approval'`, [d.run_id, userId, JSON.stringify({ approved })])
  return true
}

/** The right rail's figures: this period's runs, deliveries, approvals waiting, agent steps and tokens. */
export async function usage(userId: string) {
  const since = new Date()
  since.setUTCDate(1)
  since.setUTCHours(0, 0, 0, 0)
  const s = since.toISOString()
  const [runs, deliveries, waiting, agent, watches] = await Promise.all([
    one<{ n: number }>(`select count(*)::int as n from watch_runs where user_id = $1 and started_at >= $2::timestamptz`, [userId, s]),
    one<{ n: number }>(`select count(*)::int as n from watch_deliveries where user_id = $1 and at >= $2::timestamptz and via <> 'approval'`, [userId, s]),
    one<{ n: number }>(`select count(*)::int as n from watch_deliveries where user_id = $1 and via = 'approval' and status = 'waiting'`, [userId]),
    one<{ n: number; tokens: number }>(`select count(*)::int as n, coalesce(sum((context->'usage'->>'totalTokens')::int), 0)::int as tokens from watch_runs where user_id = $1 and started_at >= $2::timestamptz and context ? 'model'`, [
      userId,
      s,
    ]),
    one<{ n: number; on: number }>(`select count(*)::int as n, count(*) filter (where enabled)::int as "on" from watches where user_id = $1`, [userId]),
  ])
  return { period_start: s, runs: runs?.n ?? 0, deliveries: deliveries?.n ?? 0, waiting: waiting?.n ?? 0, agent_steps: agent?.n ?? 0, tokens: agent?.tokens ?? 0, watches: watches?.n ?? 0, on: watches?.on ?? 0 }
}

/** The bill a watch names, for the list's second line. */
export async function billLabels(ids: number[]) {
  if (!ids.length) return new Map<number, string>()
  const rows = await q<{ bill_id: number; state: string; bill_number: string; title: string }>(`select bill_id, state, bill_number, title from "Bills" where bill_id = any($1::bigint[])`, [ids])
  return new Map(rows.map((r) => [Number(r.bill_id), `${r.state} ${String(r.bill_number).replace(/^([A-Z]+)0*(\d+)/, "$1 $2")}: ${r.title}`]))
}
