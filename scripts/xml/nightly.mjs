// The XML step of the nightly ingestion (ops/xml/lv-xml-nightly.json): after
// the night's text delta and law loads have written Aurora, queue what they
// changed and compile it.
//
//   node scripts/xml/nightly.mjs                  queue since the last nightly run, then drain the queue
//   node scripts/xml/nightly.mjs --since 2026-09-13T09:00:00Z
//   node scripts/xml/nightly.mjs --queue-only     queue, and leave the draining to a controller under --watch
//
// What a night queues:
//   · the current Congress, again: GovInfo's bulk zips re-read, unchanged printings skipped in seconds
//   · each state with printings fetched since the last run: a "delta@<since>" job read from "BillTexts"
//   · each law "Laws" wrote since the last run: its statute job, again, unchanged sections skipped
// Every job carries run = nightly-<date>, which the Ingestion page's Runs card groups by.
import { spawn } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { one, q } from "../laws/lib/db.mjs"
import { clearReadCache } from "../laws/lib/revalidate.mjs"
import { jurisdictionOf } from "./lib/address.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const value = (name) => {
  const at = argv.indexOf(`--${name}`)
  return at >= 0 ? argv[at + 1] : null
}
const started = new Date()
const RUN = `nightly-${started.toISOString().slice(0, 10)}`
const log = (m) => console.log(`${new Date().toISOString().replace("T", " ").slice(0, 19)} ${m}`)

// Since the last nightly run began, or a day back on the first night.
const last = await one(`select min(created_at)::text as at from xml_jobs where run = (select run from xml_jobs where run like 'nightly-%' and run <> $1 order by created_at desc limit 1)`, [RUN])
const since = value("since") ?? last?.at ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString()
log(`${RUN}: changes since ${since}`)

const put = async (job) =>
  one(
    `insert into xml_jobs (jurisdiction, kind, unit, priority, run, requested_by) values ($1, $2, $3, $4, $5, 'scripts/xml/nightly.mjs')
     on conflict (jurisdiction, kind, unit) where status in ('queued', 'waiting', 'running') do nothing returning id`,
    [job.jurisdiction, job.kind, job.unit, job.priority, RUN]
  )

let queued = 0
const current = await one(`select max(session_id) as s from "Bills" where state = 'US'`)
if (current?.s && (await put({ jurisdiction: "us", kind: "bill", unit: String(current.s), priority: 5 }))) queued++

const states = await q(`select state, count(*)::int as n from "BillTexts" where fetched_at > $1::timestamptz and state <> 'US' and text is not null group by state order by state`, [since])
for (const s of states) if (await put({ jurisdiction: jurisdictionOf(s.state), kind: "bill", unit: `delta@${since}`, priority: 6 })) queued++
log(`${states.reduce((n, s) => n + s.n, 0).toLocaleString()} state printings fetched across ${states.length} jurisdictions`)

const laws = await q(`select state, law_id from "Laws" where fetched_at > $1::timestamptz group by state, law_id order by state, law_id`, [since])
for (const l of laws) if (await put({ jurisdiction: jurisdictionOf(l.state), kind: "statute", unit: l.law_id, priority: 7 })) queued++
log(`${laws.length.toLocaleString()} laws written since then`)
log(`${queued} jobs queued for ${RUN}`)

if (argv.includes("--queue-only")) process.exit(0)

// Drain the night's own jobs; the controller exits when none is left.
const child = spawn(process.execPath, ["--max-old-space-size=8192", join(HERE, "run.mjs"), "--slots", "2", "--run", "nightly-"], { stdio: "inherit" })
child.on("exit", async (code) => {
  log(`${RUN} finished in ${((Date.now() - started.getTime()) / 60000).toFixed(1)} min, controller exit ${code}`)
  // The site's read cache holds yesterday's answers until told otherwise.
  log(await clearReadCache(["expressions", "xml_library", "Bills", "BillTexts", "Laws"]))
  process.exit(code ?? 1)
})
