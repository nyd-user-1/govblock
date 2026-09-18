import "server-only"

import type { ChartSpec } from "./chart-spec"
import MATCHES from "./data/model-bill-matches.json"

// Copy-and-paste lawmaking (2026-09-18), research recipe report #3. The
// matching (stages 3–5) is expensive, a phrase search of every state bill's
// text for each model, so it runs once in scripts/research/model-bills.mjs and
// this reads its dated output.
//
// Codebook: a *copy* is a bill whose text carries the model's short title and
// at least one ten-word sentence from the model's body; a *namesake* carries
// the title alone. *Passed* is the bill's status when matched: passed or
// signed.

const SLUG = "model-bills"
const PASSED = new Set([4, 6])

type Hit = { bill_id: number; state: string; bill_number: string; session: string | null; status: number; status_desc: string; title: string; copy: boolean }
type Result = { model_id: string; title: string; short: string; year?: number; issue?: string; url?: string; hits: Hit[]; error?: string }

export function modelBillsStudy() {
  const data = MATCHES as { built: string; models: number; searched: number; results: Result[] }
  const results = data.results.filter((r) => !r.error)
  const copies = results.flatMap((r) => r.hits.filter((h) => h.copy).map((h) => ({ ...h, model: r })))
  const namesakes = results.flatMap((r) => r.hits.filter((h) => !h.copy))
  const passed = copies.filter((c) => PASSED.has(c.status))

  const models = results
    .filter((r) => r.hits.some((h) => h.copy))
    .map((r) => {
      const c = r.hits.filter((h) => h.copy)
      return {
        id: r.model_id,
        title: r.short || r.title,
        issue: r.issue ?? "",
        year: r.year ?? null,
        url: r.url ?? null,
        copies: c.length,
        passed: c.filter((h) => PASSED.has(h.status)).length,
        states: [...new Set(c.map((h) => h.state))].sort(),
        passedIn: [...new Set(c.filter((h) => PASSED.has(h.status)).map((h) => h.state))].sort(),
      }
    })
    .sort((a, b) => b.passed - a.passed || b.copies - a.copies)

  const tally = (list: { state: string }[]) => {
    const m = new Map<string, number>()
    for (const x of list) m.set(x.state, (m.get(x.state) ?? 0) + 1)
    return m
  }
  const byStateCopies = tally(copies)
  const byStatePassed = tally(passed)
  const states = [...byStateCopies]
    .map(([state, n]) => ({ state, copies: n, passed: byStatePassed.get(state) ?? 0, models: new Set(copies.filter((c) => c.state === state).map((c) => c.model.model_id)).size }))
    .sort((a, b) => b.passed - a.passed || b.copies - a.copies)

  const issues = new Map<string, { copies: number; passed: number }>()
  for (const c of copies) {
    const k = c.model.issue || "Other"
    const e = issues.get(k) ?? { copies: 0, passed: 0 }
    e.copies++
    if (PASSED.has(c.status)) e.passed++
    issues.set(k, e)
  }

  const enacted = passed
    .map((c) => ({ state: c.state, bill: c.bill_number, billId: c.bill_id, session: c.session, status: c.status_desc, title: c.title, model: c.model.short || c.model.title }))
    .sort((a, b) => (b.session ?? "").localeCompare(a.session ?? "") || a.state.localeCompare(b.state))

  const charts: ChartSpec[] = [
    {
      id: "model-bills-states",
      report: SLUG,
      kind: "bar",
      title: "State bills carrying ALEC model text that passed, by state",
      source: `GovBlock's record of state bill text, matched against ALEC's model policies; built ${data.built}.`,
      format: "int",
      bars: states
        .filter((s) => s.passed > 0)
        .slice(0, 12)
        .map((s) => ({ label: s.state, value: s.passed, note: `${s.copies} copies filed, from ${s.models} models` })),
    },
  ]

  return {
    built: data.built,
    modelsTotal: data.models,
    searched: data.searched,
    matchedModels: results.length,
    unsearched: data.results.length - results.length,
    copies: copies.length,
    namesakes: namesakes.length,
    passed: passed.length,
    models,
    states,
    issues: [...issues].map(([issue, v]) => ({ issue, ...v })).sort((a, b) => b.copies - a.copies),
    enacted,
    charts,
  }
}
