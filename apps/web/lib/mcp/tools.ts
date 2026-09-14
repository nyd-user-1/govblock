import "server-only"

import { stateName } from "@/lib/filters"
import type { Entity } from "@/lib/entitlements"
import {
  getBill,
  getBillText,
  getBillVotes,
  getBills,
  getCalendar,
  getCommittee,
  getCommittees,
  getMember,
  getMembers,
  getRollCall,
  getRollCalls,
  getSessions,
  getStates,
  resolve,
  searchAll,
} from "@/lib/policy/db-queries"

// The GovBlocks MCP toolset (2026-09-13), on leuk's and 44b's design: plain
// async functions over the read functions the site itself draws its pages
// from, in lib/policy/db-queries.ts. No MCP types, no Zod — the transport
// (app/api/mcp/route.ts) owns schemas, auth, metering and shaping. Every
// tool names the entity it reads, so the transport can hold each call to
// the same entitlement rule the site and the REST API apply.
//
// RESULT SHAPE DISCIPLINE. These land in someone else's context window.
// Return the fields a reader of the record needs, cap every limit here
// whatever was asked for, and put a site path (`href`) on every record so an
// answer is checkable; the transport rewrites `href` into an absolute `url`.

const MAX = 25
const cap = (v: number | undefined, fallback: number) => Math.max(1, Math.min(MAX, Math.floor(v ?? fallback)))

export type Scope = { state?: string; session?: number }

/** The jurisdiction and session a tool reads, resolved the way the API resolves them. */
async function scope(s: Scope) {
  const state = (s.state ?? "US").toUpperCase()
  return resolve({ state, session: s.session ? String(s.session) : undefined })
}

type BillLike = { bill_id: number; bill_number: string; title: string; status_desc?: string | null; last_action?: string | null; last_action_date?: string | null; committee?: string | null; sponsor?: string | null; sponsor_party?: string | null; body?: string | null }

const billCard = (b: BillLike, state: string) => ({
  bill_id: b.bill_id,
  bill_number: b.bill_number,
  title: b.title,
  status: b.status_desc ?? null,
  last_action: b.last_action ?? null,
  last_action_date: b.last_action_date ?? null,
  committee: b.committee ?? null,
  chamber: b.body ?? null,
  sponsor: b.sponsor ? `${b.sponsor}${b.sponsor_party ? ` (${b.sponsor_party})` : ""}` : null,
  href: `/bills/${b.bill_id}?state=${state}`,
})

/** What each tool reads, for the entitlement rule. */
export const TOOL_ENTITY: Record<string, Entity> = {
  search: "search",
  list_bills: "bills",
  get_bill: "bills",
  get_bill_text: "bills",
  list_members: "members",
  get_member: "members",
  list_committees: "committees",
  get_committee: "committees",
  list_roll_calls: "votes",
  get_roll_call: "votes",
  calendar: "calendar",
  record_status: "meta",
}

export async function runSearch(a: Scope & { q: string; limit?: number }) {
  const f = await scope(a)
  const r = await searchAll(f, a.q, cap(a.limit, 8), { all: true })
  return {
    q: r.q,
    bills: r.bills.map((b) => ({ ...billCard(b, String((b as { state?: string }).state ?? f.state)), state: (b as { state?: string }).state ?? f.state })),
    members: r.members.map((m) => ({ people_id: m.people_id, name: m.name, party: m.party, chamber: m.chamber, district: m.district, state: m.state, href: `/members/${m.people_id}?state=${m.state}` })),
    committees: r.committees.map((c) => ({ committee: c.committee, chamber: c.chamber, bills: c.bills, state: (c as { state?: string }).state ?? f.state, href: `/bills?state=${(c as { state?: string }).state ?? f.state}&committee=${encodeURIComponent(c.committee)}` })),
  }
}

export async function runListBills(a: Scope & { limit?: number; offset?: number; committee?: string; chamber?: string; subject?: string; status?: string }) {
  const f = await scope({ ...a })
  const r = await getBills({ ...f, committee: a.committee, chamber: a.chamber, subject: a.subject, status: a.status }, cap(a.limit, 10), Math.max(0, Math.floor(a.offset ?? 0)))
  return { state: f.state, jurisdiction: f.state === "US" ? "Congress" : stateName(f.state), session: f.session, total: r.total, rows: r.rows.map((b) => billCard(b, f.state)) }
}

export async function runGetBill(a: { bill_id: number }) {
  const b = await getBill(a.bill_id)
  if (!b) return { error: "not_found", bill_id: a.bill_id }
  const { history, texts, sponsors, ...rest } = b as unknown as Record<string, unknown> & { history?: unknown[]; texts?: unknown[]; sponsors?: unknown[] }
  return { ...rest, href: `/bills/${a.bill_id}?state=${(b as { state: string }).state}`, sponsors: Array.isArray(sponsors) ? sponsors.slice(0, 40) : [], history: Array.isArray(history) ? history.slice(0, 60) : [], texts: Array.isArray(texts) ? texts.slice(0, 20) : [] }
}

/** The text in windows: the longest bills run to millions of characters. */
export async function runGetBillText(a: { bill_id: number; document_id?: number; from?: number; chars?: number }) {
  const chars = Math.max(500, Math.min(20_000, Math.floor(a.chars ?? 8_000)))
  const r = await getBillText(a.bill_id, a.document_id, { chars, from: Math.max(0, Math.floor(a.from ?? 0)) })
  if (!r) return { error: "not_found", bill_id: a.bill_id }
  return { ...r, href: `/bills/${a.bill_id}` }
}

export async function runListMembers(a: Scope & { chamber?: string; party?: string; limit?: number }) {
  const f = await scope(a)
  const rows = await getMembers({ ...f, chamber: a.chamber, party: a.party })
  return {
    state: f.state,
    session: f.session,
    total: rows.length,
    rows: rows.slice(0, cap(a.limit, 25)).map((m) => ({ people_id: m.people_id, name: m.name, party: m.party, chamber: m.chamber, district: m.district, role: m.role, href: `/members/${m.people_id}?state=${f.state}` })),
  }
}

export async function runGetMember(a: Scope & { people_id: number }) {
  const f = await scope(a)
  const m = await getMember(a.people_id, f.session)
  if (!m) return { error: "not_found", people_id: a.people_id }
  const { bio_long, ...rest } = m as unknown as Record<string, unknown> & { bio_long?: string | null }
  return { ...rest, bio: typeof bio_long === "string" ? bio_long.slice(0, 1_500) : null, bills: (m.bills ?? []).slice(0, 15), href: `/members/${a.people_id}?state=${f.state}` }
}

export async function runListCommittees(a: Scope) {
  const f = await scope(a)
  const rows = await getCommittees(f)
  return { state: f.state, session: f.session, rows: rows.map((c) => ({ ...c, href: `/bills?state=${f.state}&committee=${encodeURIComponent(c.committee_name)}` })) }
}

export async function runGetCommittee(a: Scope & { name: string }) {
  const f = await scope(a)
  const c = await getCommittee(f, a.name)
  const { bills, ...rest } = c as unknown as Record<string, unknown> & { bills?: BillLike[] }
  return { ...rest, bills: Array.isArray(bills) ? bills.slice(0, 25).map((b) => billCard(b, f.state)) : [], href: `/bills?state=${f.state}&committee=${encodeURIComponent(a.name)}` }
}

export async function runListRollCalls(a: Scope & { limit?: number }) {
  const f = await scope(a)
  const rows = await getRollCalls(f, cap(a.limit, 25))
  return { state: f.state, session: f.session, rows: rows.map((r) => ({ ...r, href: `/roll-call-votes/${r.roll_call_id}?state=${f.state}` })) }
}

export async function runGetRollCall(a: { roll_call_id: number; bill_id?: number }) {
  const r = await getRollCall(a.roll_call_id)
  if (!r) return { error: "not_found", roll_call_id: a.roll_call_id }
  const { votes, ...rest } = r as unknown as Record<string, unknown> & { votes?: unknown[] }
  return { ...rest, votes: Array.isArray(votes) ? votes.slice(0, 600) : [], href: `/roll-call-votes/${a.roll_call_id}` }
}

export async function runBillVotes(a: { bill_id: number }) {
  return { bill_id: a.bill_id, ...(await getBillVotes(a.bill_id)), href: `/bills/${a.bill_id}` }
}

const day = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

export async function runCalendar(a: Scope & { from?: string; to?: string; committee?: string; limit?: number }) {
  const f = await scope(a)
  const r = await getCalendar(f, { from: a.from ?? day(), to: a.to ?? day(45), committee: a.committee ?? null, limit: cap(a.limit, 25) })
  return { ...r, href: `/calendar?state=${f.state}` }
}

/** What the record holds: every jurisdiction, and the sessions of one. Free, for orientation. */
export async function runRecordStatus(a: { state?: string }) {
  if (a.state) {
    const state = a.state.toUpperCase()
    const sessions = await getSessions(state)
    return { state, jurisdiction: state === "US" ? "Congress" : stateName(state), sessions, href: `/bills?state=${state}` }
  }
  const states = await getStates()
  return { jurisdictions: states, href: "/workspace/data" }
}
