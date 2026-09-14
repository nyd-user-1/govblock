import "server-only"

import { createHash, randomBytes, randomUUID } from "node:crypto"

import { one, q } from "@/lib/policy/db"
import { isPlan, PLANS, type Plan } from "@/lib/plans"

// API keys (2026-09-13), on 44b's design: the database holds a SHA-256 hash
// and a 9-character prefix; the plaintext is shown once at creation and never
// stored or logged. Usage is one row per key per UTC day, bumped by a single
// atomic upsert per request; a month is the sum of that month's rows.

/** `gb_` + 40 hex: 20 random bytes, 160 bits. */
const KEY_PREFIX = "gb_"
const PREFIX_LEN = KEY_PREFIX.length + 6

export type ApiKeyRow = { id: string; keyPrefix: string; name: string | null; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

const row = (r: Record<string, unknown>): ApiKeyRow => ({
  id: String(r.id),
  keyPrefix: String(r.key_prefix),
  name: (r.name as string | null) ?? null,
  createdAt: String(r.created_at),
  lastUsedAt: (r.last_used_at as string | null) ?? null,
  revokedAt: (r.revoked_at as string | null) ?? null,
})

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const rows = await q<Record<string, unknown>>(
    `select id, key_prefix, name, created_at::text as created_at, last_used_at::text as last_used_at, revoked_at::text as revoked_at
     from api_keys where user_id = $1 order by created_at desc`,
    [userId]
  )
  return rows.map(row)
}

export async function countActiveKeys(userId: string) {
  const r = await one<{ n: number }>(`select count(*)::int as n from api_keys where user_id = $1 and revoked_at is null`, [userId])
  return Number(r?.n ?? 0)
}

/** The reader's plan, from the profile; free when there is no row. */
export async function planOf(userId: string): Promise<Plan> {
  const r = await one<{ plan: string }>(`select plan from reader_profiles where user_id = $1`, [userId])
  return isPlan(r?.plan) ? r.plan : "free"
}

export type CreateKeyResult = { ok: true; key: string; row: ApiKeyRow } | { ok: false; error: string }

/** Mints a key for the reader, within the plan's allowance. The plaintext is in the result and nowhere else. */
export async function createApiKey(userId: string, plan: Plan, name: string | null): Promise<CreateKeyResult> {
  const max = PLANS[plan].maxKeys
  if (max === 0) return { ok: false, error: "API keys come with a plan. See /pricing." }
  if ((await countActiveKeys(userId)) >= max) return { ok: false, error: `${max} of ${max} keys in use. Revoke one to add another.` }
  const key = KEY_PREFIX + randomBytes(20).toString("hex")
  const r = await one<Record<string, unknown>>(
    `insert into api_keys (id, user_id, key_hash, key_prefix, name) values ($1, $2, $3, $4, $5)
     returning id, key_prefix, name, created_at::text as created_at, last_used_at::text as last_used_at, revoked_at::text as revoked_at`,
    [randomUUID(), userId, hashKey(key), key.slice(0, PREFIX_LEN), name]
  )
  if (!r) return { ok: false, error: "The key could not be saved." }
  return { ok: true, key, row: row(r) }
}

/** Revokes one of the reader's keys. False when it was not theirs or already revoked. */
export async function revokeApiKey(userId: string, keyId: string) {
  const rows = await q<{ id: string }>(`update api_keys set revoked_at = now() where id = $1 and user_id = $2 and revoked_at is null returning id`, [keyId, userId])
  return rows.length > 0
}

export type ResolvedKey = { keyId: string; userId: string; plan: Plan; home: string | null }

/** A presented key, by hash. Unknown and revoked keys are both null. */
export async function resolveApiKey(presented: string): Promise<ResolvedKey | null> {
  const key = presented.trim()
  if (!key.startsWith(KEY_PREFIX) || key.length < 20) return null
  const r = await one<{ id: string; user_id: string; plan: string | null; home_state: string | null }>(
    `select k.id, k.user_id, p.plan, p.home_state from api_keys k left join reader_profiles p on p.user_id = k.user_id
     where k.key_hash = $1 and k.revoked_at is null`,
    [hashKey(key)]
  )
  if (!r) return null
  return { keyId: r.id, userId: r.user_id, plan: isPlan(r.plan) ? r.plan : "free", home: r.home_state ?? null }
}

/** The key off either accepted header; never logged. */
export function presentedKey(request: Request): string | null {
  const auth = request.headers.get("authorization")
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
    if (m) return m[1].trim()
  }
  return request.headers.get("x-api-key")?.trim() || null
}

export async function touchApiKey(keyId: string) {
  try {
    await q(`update api_keys set last_used_at = now() where id = $1`, [keyId])
  } catch {
    // A convenience column; never in the request's way.
  }
}

export type UsageWindow = { day: number; month: number }

/** Counts this request against the key, then reads the day and the month. One upsert, one sum. */
export async function recordUsage(keyId: string): Promise<UsageWindow> {
  await q(
    `insert into api_usage (api_key_id, day, count) values ($1, (now() at time zone 'utc')::date, 1)
     on conflict (api_key_id, day) do update set count = api_usage.count + 1`,
    [keyId]
  )
  const r = await one<{ day: number; month: number }>(
    `select coalesce(sum(count) filter (where day = (now() at time zone 'utc')::date), 0)::int as day,
            coalesce(sum(count), 0)::int as month
     from api_usage where api_key_id = $1 and day >= date_trunc('month', (now() at time zone 'utc'))::date`,
    [keyId]
  )
  return { day: Number(r?.day ?? 0), month: Number(r?.month ?? 0) }
}

/** The reader's usage across every key they hold, for the settings page. */
export async function getUsageForUser(userId: string): Promise<UsageWindow> {
  const r = await one<{ day: number; month: number }>(
    `select coalesce(sum(u.count) filter (where u.day = (now() at time zone 'utc')::date), 0)::int as day,
            coalesce(sum(u.count), 0)::int as month
     from api_usage u join api_keys k on k.id = u.api_key_id
     where k.user_id = $1 and u.day >= date_trunc('month', (now() at time zone 'utc'))::date`,
    [userId]
  )
  return { day: Number(r?.day ?? 0), month: Number(r?.month ?? 0) }
}

export function nextUtcMidnight(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
}

export function nextUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

/** The 429 body and headers a metered surface answers with, shared by the API and the MCP server. */
export function limitExceeded(usage: UsageWindow, plan: Plan): { limit: number; window: "day" | "month"; retry_at: string } | null {
  const spec = PLANS[plan]
  if (spec.dailyBurstLimit !== undefined && usage.day > spec.dailyBurstLimit) return { limit: spec.dailyBurstLimit, window: "day", retry_at: nextUtcMidnight() }
  if (spec.monthlyApiLimit !== undefined && usage.month > spec.monthlyApiLimit) return { limit: spec.monthlyApiLimit, window: "month", retry_at: nextUtcMonth() }
  return null
}

/** The window the caller is closest to exhausting, for the X-RateLimit headers. */
export function rateLimitHeaders(usage: UsageWindow, plan: Plan): Record<string, string> {
  const spec = PLANS[plan]
  const day = spec.dailyBurstLimit ?? Infinity
  const month = spec.monthlyApiLimit ?? Infinity
  const dayLeft = day - usage.day
  const monthLeft = month - usage.month
  const tight = dayLeft <= monthLeft ? { limit: day, remaining: dayLeft, window: "day" } : { limit: month, remaining: monthLeft, window: "month" }
  return { "X-RateLimit-Limit": String(tight.limit), "X-RateLimit-Remaining": String(Math.max(0, tight.remaining)), "X-RateLimit-Window": tight.window }
}
