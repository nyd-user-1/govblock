// Pull the Exa monitors' runs into news_briefs.
//
//   node scripts/news/briefs.mjs            every monitor on the account, its last ten runs
//   node scripts/news/briefs.mjs --trigger  run the state-legislature monitor now, wait, then pull
//
// A monitor is a saved Exa search that runs on a schedule (2026-09-09: "State
// Legislature News", daily). Each completed run carries a grounded brief —
// `output.content`, a few cited bullets — beside its results. The monitor's
// webhook points at a test sink for now, so this pulls; the same rows arrive
// through apps/web/app/api/news/monitor/route.ts when the webhook is pointed
// at production. Reads EXA_API_KEY and the Aurora ARNs from apps/web/.env.local.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  readFileSync(join(ROOT, "apps/web/.env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
)
const key = (env.EXA_API_KEY || "").trim()
if (!key) throw new Error("EXA_API_KEY must be set in apps/web/.env.local")
const headers = { authorization: `Bearer ${key}`, "content-type": "application/json" }
const TRIGGER = process.argv.includes("--trigger")

const resourceArn = env.POLICY_CLUSTER_ARN
const secretArn = env.POLICY_SECRET_ARN
const database = env.POLICY_DATABASE || "policy"
const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })
const s = (v) => (v === null || v === undefined || v === "" ? { isNull: true } : { stringValue: String(v) })
async function exec(sql, parameters) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.send(new ExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameters, continueAfterTimeout: true }))
    } catch (e) {
      if (/resuming|DatabaseResuming|Throttl/i.test(String(e?.message ?? e)) && attempt < 20) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
}

// One table for every brief the site shows: Exa's national one (scope
// "states") and the Reporter's per-desk ones (scope = the postal code), so
// /briefing and /news read the same shape.
export const DDL = [
  `create table if not exists news_briefs (
     id bigserial primary key,
     scope text not null,
     author text not null,
     run_id text unique,
     monitor_id text,
     title text,
     content text not null,
     grounding jsonb not null default '[]'::jsonb,
     results jsonb not null default '[]'::jsonb,
     model text,
     usd numeric,
     completed_at timestamptz not null default now(),
     created_at timestamptz not null default now())`,
  `create index if not exists news_briefs_scope_completed_idx on news_briefs (scope, completed_at desc)`,
]

/** Which desk a monitor writes for: the national one unless its name says a state. */
const scopeOf = (monitor) => (monitor.metadata?.scope ? String(monitor.metadata.scope).toUpperCase() : "states")

async function main() {
  for (const sql of DDL) await exec(sql)
  const { data: monitors = [] } = await (await fetch("https://api.exa.ai/monitors", { headers })).json()
  console.log(`${monitors.length} monitors`)
  let written = 0
  for (const monitor of monitors) {
    if (!/legislat|state|congress|govblock/i.test(`${monitor.name} ${monitor.search?.query ?? ""}`)) {
      console.log(`  skip ${monitor.name} — not ours`)
      continue
    }
    if (TRIGGER) {
      const t = await fetch(`https://api.exa.ai/monitors/${monitor.id}/trigger`, { method: "POST", headers })
      console.log(`  triggered ${monitor.name}: ${t.status}`)
      await new Promise((r) => setTimeout(r, 20000))
    }
    const { data: runs = [] } = await (await fetch(`https://api.exa.ai/monitors/${monitor.id}/runs?limit=10`, { headers })).json()
    for (const run of runs) {
      if (run.status !== "completed" || !run.output?.content) continue
      await exec(
        `insert into news_briefs (scope, author, run_id, monitor_id, title, content, grounding, results, completed_at)
         values (:scope, 'exa', :run_id, :monitor_id, :title, :content, cast(:grounding as jsonb), cast(:results as jsonb), cast(:completed_at as timestamptz))
         on conflict (run_id) do update set content = excluded.content, grounding = excluded.grounding, results = excluded.results`,
        [
          { name: "scope", value: s(scopeOf(monitor)) },
          { name: "run_id", value: s(run.id) },
          { name: "monitor_id", value: s(monitor.id) },
          { name: "title", value: s(monitor.name) },
          { name: "content", value: s(run.output.content) },
          { name: "grounding", value: s(JSON.stringify(run.output.grounding ?? [])) },
          { name: "results", value: s(JSON.stringify((run.output.results ?? []).map((r) => ({ title: r.title, url: r.url, publishedDate: r.publishedDate, author: r.author ?? null, image: r.image ?? null })))) },
          { name: "completed_at", value: s(run.completedAt ?? run.createdAt) },
        ],
      )
      written++
    }
    console.log(`  ${monitor.name}: ${runs.length} runs`)
  }
  console.log(`${written} briefs written`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
