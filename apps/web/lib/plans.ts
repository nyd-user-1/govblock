// plans.ts — what a GovBlocks plan buys, in one place (2026-09-13). The
// pricing page, the settings page, the API docs, the policy route's limiter
// and the MCP server all read this map; no price or limit is typed anywhere
// else. Nobody holds a paid plan yet: `reader_profiles.plan` is set by hand
// until Stripe exists.

export type Plan = "free" | "team" | "pro" | "custom"

export type PlanSpec = {
  label: string
  /** USD per seat per month. */
  priceMonthly: number
  /** Requests per UTC calendar month across the API and the MCP server. Absent = no keyed access. */
  monthlyApiLimit?: number
  /** Requests per UTC day — the runaway-script ceiling. */
  dailyBurstLimit?: number
  /** Live keys at once; revoked keys do not count. */
  maxKeys: number
  blurb: string
}

export const PLANS: Record<Plan, PlanSpec> = {
  free: { label: "Free", priceMonthly: 0, maxKeys: 0, blurb: "Congress and your home state, on the site." },
  team: { label: "Team", priceMonthly: 99, monthlyApiLimit: 10_000, dailyBurstLimit: 1_000, maxKeys: 3, blurb: "The record for the states you work, by API and MCP." },
  pro: { label: "Pro", priceMonthly: 399, monthlyApiLimit: 100_000, dailyBurstLimit: 10_000, maxKeys: 5, blurb: "All fifty states, by API and MCP." },
  custom: { label: "Custom", priceMonthly: 799, monthlyApiLimit: 1_000_000, dailyBurstLimit: 100_000, maxKeys: 25, blurb: "An office on the record, at its own limits." },
}

export const isPlan = (value: unknown): value is Plan => typeof value === "string" && value in PLANS

/** Whether a plan may call the API and the MCP server with a key. */
export const hasApiAccess = (plan: Plan) => PLANS[plan].monthlyApiLimit !== undefined
