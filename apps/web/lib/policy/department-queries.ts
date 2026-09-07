import "server-only"

import { n, one, q } from "@/lib/policy/db"
import { type Department, nameKey } from "@/lib/data/departments"
import { BILL_COLUMNS, PRIME_SPONSOR, type BillRow, type Resolved, withLatestTexts } from "@/lib/policy/db-queries"
import { getForms } from "@/lib/policy/forms-queries"

// What a department's page reads: New York's budget for it (the three tables
// the old policy site kept in Supabase, loaded into Aurora 2026-09-06 as
// ny_budget_appropriations, ny_budget_capital and ny_budget_spending), the
// bills that name it, and the nominations to it.

/* ---- the budget ---------------------------------------------------------- */

export type AppropriationRow = {
  program: string | null
  fund_type: string | null
  fund_name: string | null
  category: string | null
  available_prior: number | null
  recommended: number | null
  reappropriations: number | null
  ftes: number | null
}
export type CapitalRow = {
  program: string | null
  description: string | null
  purpose: string | null
  fund_name: string | null
  financing: string | null
  recommended: number | null
  reappropriations: number | null
  encumbrance: number | null
}
export type SpendingRow = {
  function: string | null
  fund_type: string | null
  fund: string | null
  fp_category: string | null
  actual_prior2: number | null
  actual_prior: number | null
  estimate_current: number | null
  estimate_next: number | null
}

export type DepartmentBudget = {
  /** The budget's own spellings of the agency, matched by their words. */
  agencies: string[]
  appropriations: AppropriationRow[]
  capital: CapitalRow[]
  spending: SpendingRow[]
}

let agencyCache: { at: number; value: string[] } | null = null

/** Every agency name the three budget tables use, once an hour. */
async function budgetAgencies() {
  if (agencyCache && Date.now() - agencyCache.at < 3_600_000) return agencyCache.value
  const rows = await q<{ agency: string }>(
    `select agency from (select distinct agency from ny_budget_appropriations union select distinct agency from ny_budget_capital union select distinct agency from ny_budget_spending) a where agency is not null`
  )
  agencyCache = { at: Date.now(), value: rows.map((r) => r.agency) }
  return agencyCache.value
}

/** The budget's rows for a department: the agencies whose words are the department's. */
export async function getDepartmentBudget(department: Department): Promise<DepartmentBudget> {
  if (department.state !== "NY") return { agencies: [], appropriations: [], capital: [], spending: [] }
  const key = nameKey(department.name)
  const agencies = (await budgetAgencies()).filter((a) => nameKey(a) === key)
  if (!agencies.length) return { agencies, appropriations: [], capital: [], spending: [] }
  const number = (v: unknown) => (v == null || v === "" ? null : Number(v))
  const [appropriations, capital, spending] = await Promise.all([
    q<AppropriationRow>(
      `select program, fund_type, fund_name, category, available_prior, recommended, reappropriations, ftes
         from ny_budget_appropriations where agency = any($1::text[]) order by recommended desc nulls last, program`,
      [agencies]
    ),
    q<CapitalRow>(
      `select program, description, purpose, fund_name, financing, recommended, reappropriations, encumbrance
         from ny_budget_capital where agency = any($1::text[]) order by coalesce(recommended, 0) + coalesce(reappropriations, 0) desc, program`,
      [agencies]
    ),
    q<SpendingRow>(
      `select function, fund_type, fund, fp_category, actual_prior2, actual_prior, estimate_current, estimate_next
         from ny_budget_spending where agency = any($1::text[]) order by estimate_next desc nulls last, fund`,
      [agencies]
    ),
  ])
  return {
    agencies,
    appropriations: appropriations.map((r) => ({ ...r, available_prior: number(r.available_prior), recommended: number(r.recommended), reappropriations: number(r.reappropriations), ftes: number(r.ftes) })),
    capital: capital.map((r) => ({ ...r, recommended: number(r.recommended), reappropriations: number(r.reappropriations), encumbrance: number(r.encumbrance) })),
    spending: spending.map((r) => ({ ...r, actual_prior2: number(r.actual_prior2), actual_prior: number(r.actual_prior), estimate_current: number(r.estimate_current), estimate_next: number(r.estimate_next) })),
  }
}

/* ---- the bills ------------------------------------------------------------- */

/** "Department of Health" as a bill would print it: the name, with New York's prefix and any bracketed aside gone. */
export function billPattern(department: Department) {
  return department.name
    .replace(/\(.*?\)/g, "")
    .replace(/^New York State\s+|^NYS\s+/i, "")
    .trim()
}

/** The bills of the session that name the department in their title or summary, newest action first, with the count. */
export async function getDepartmentBills(f: Resolved, department: Department, limit = 25, offset = 0) {
  const pattern = `%${billPattern(department)}%`
  const where = `b.state = $1 and b.session_id = $2 and (b.title ilike $3 or b.description ilike $3)`
  const [rows, total] = await Promise.all([
    q<BillRow>(
      `select ${BILL_COLUMNS} from "Bills" b ${PRIME_SPONSOR}
        where ${where}
        order by b.last_action_date desc nulls last, b.bill_id desc limit $4 offset $5`,
      [f.state, f.session, pattern, limit, offset]
    ),
    one<{ n: number }>(`select count(*)::int as n from "Bills" b where ${where}`, [f.state, f.session, pattern]),
  ])
  return { rows: await withLatestTexts(rows.map((r) => ({ ...r, bill_id: n(r.bill_id) }))), total: n(total?.n) }
}

/* ---- the nominations ------------------------------------------------------- */

export type DepartmentNomination = { key: string; citation: string | null; description: string | null; organization: string | null; received: string | null; latest_action: string | null; latest_action_date: string | null }

/** The nominations to a federal department this Congress, newest first, with the count. */
export async function getDepartmentNominations(department: Department, limit = 25, offset = 0) {
  if (department.state !== "US" || !department.organizations.length) return { rows: [] as DepartmentNomination[], total: 0 }
  const [rows, total] = await Promise.all([
    q<DepartmentNomination>(
      `select key, citation, description, organization, received_date as received, latest_action, latest_action_date
         from congress_nominations where organization = any($1::text[])
        order by received_date desc nulls last, key desc limit $2 offset $3`,
      [department.organizations, limit, offset]
    ),
    one<{ n: number }>(`select count(*)::int as n from congress_nominations where organization = any($1::text[])`, [department.organizations]),
  ])
  return { rows, total: n(total?.n) }
}

/** How many bills of the session name each department, for the index's cards. */
export async function getDepartmentBillCounts(f: Resolved, departments: Department[]) {
  if (!departments.length) return new Map<string, number>()
  const patterns = departments.map((d) => `%${billPattern(d)}%`)
  const rows = await q<{ i: number; n: number }>(
    `select p.i, count(b.bill_id)::int as n
       from unnest($3::text[]) with ordinality as p(pattern, i)
       left join "Bills" b on b.state = $1 and b.session_id = $2 and (b.title ilike p.pattern or b.description ilike p.pattern)
      group by p.i`,
    [f.state, f.session, patterns]
  )
  const out = new Map<string, number>()
  for (const r of rows) {
    const d = departments[n(r.i) - 1]
    if (d) out.set(d.slug, n(r.n))
  }
  return out
}

/* ---- the forms ------------------------------------------------------------- */

/**
 * The department's forms, a page at a time. An agency the harvest never
 * opened (DOL, USDA-FNS) has nothing that passes the Forms cut, so its page
 * lists every PDF filed under it instead and says that it has (Brendan,
 * 2026-09-06: "put a list block with each department's forms").
 */
export async function getDepartmentForms(department: Department, limit = 25, offset = 0) {
  const agency = department.forms[0]
  if (!agency) return { rows: [], count: 0, inspected: true }
  const page = Math.floor(offset / limit) + 1
  // Forms first. When nothing passes the cut — the agency was never opened, or
  // is being opened tonight and has not finished — every PDF filed under it
  // stands in, and the block says so.
  const forms = await getForms({ state: department.state, agency, limit, page })
  if (forms?.count) return { rows: forms.rows, count: forms.count, inspected: true }
  const everything = await getForms({ state: department.state, agency, limit, page, all: true })
  return { rows: everything?.rows ?? [], count: everything?.count ?? 0, inspected: false }
}
