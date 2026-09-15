// Puts jobs in the queue the controller reads. The dashboard's run controls
// write the same rows through app/api/xml/jobs.
//
//   node scripts/xml/enqueue.mjs --plan                         the whole corpus, in the program's order
//   node scripts/xml/enqueue.mjs --juris us --kind bill         every federal session
//   node scripts/xml/enqueue.mjs --juris us-ny --kind statute --units PEN,AGM
//   node scripts/xml/enqueue.mjs --juris us --kind bill --units 2025 --priority 1
//
// A unit with a job already queued, waiting or running is left as it is.
import { createRequire } from "node:module"

import { q } from "../laws/lib/db.mjs"
import { BUCKET, jurisdictionOf } from "./lib/address.mjs"
import { enqueue } from "./lib/store.mjs"
import { FIRST_CONGRESS_WITH_XML } from "./sources/federal-bills.mjs"

const require = createRequire(import.meta.url)
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3")

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name, fallback = null) => {
  const at = argv.indexOf(`--${name}`)
  return at >= 0 ? argv[at + 1] : fallback
}
const RUN = value("run", `backfill-${new Date().toISOString().slice(0, 10)}`)
const BY = value("by", "scripts/xml/enqueue.mjs")

// The program's order (window 2 brief, "The loads"): federal bills newest
// first, the US Code, New York's statutes, every other state's statutes,
// then state bills by session, newest first.
const PRIORITY = { federalBills: 10, usc: 30, nyStatutes: 40, statutes: 50, stateBills: 60 }
// A state whose "Laws" holds hundreds of separate acts (Illinois' 2,816) is one job, not hundreds.
const MANY_LAWS = 150

const congressOf = (year) => Math.floor((Number(year) - 1789) / 2) + 1
let added = 0
let kept = 0
const put = async (job) => {
  const r = await enqueue({ run: RUN, requestedBy: BY, ...job })
  r ? added++ : kept++
}

async function federalBills(units) {
  const sessions = units ?? (await q(`select distinct session_id from "Bills" where state = 'US' order by 1 desc`)).map((r) => String(r.session_id))
  for (const unit of sessions) {
    const congress = congressOf(unit)
    if (congress < FIRST_CONGRESS_WITH_XML)
      await put({ jurisdiction: "us", kind: "bill", unit, priority: PRIORITY.federalBills, status: "blocked", reason: `the ${congress}th Congress: GovInfo publishes no bill XML before the ${FIRST_CONGRESS_WITH_XML}th, and "BillTexts" holds no federal text before 2013` })
    else await put({ jurisdiction: "us", kind: "bill", unit, priority: PRIORITY.federalBills + (2025 - Number(unit)) / 2 })
  }
}

async function statutes(state, units, priority) {
  const laws = units ?? (await q(`select distinct law_id from "Laws" where state = $1 order by 1`, [state])).map((r) => r.law_id)
  const juris = jurisdictionOf(state)
  if (!units && laws.length > MANY_LAWS) return put({ jurisdiction: juris, kind: "statute", unit: "*", priority })
  for (const unit of laws) await put({ jurisdiction: juris, kind: "statute", unit, priority })
}

/** The sessions the lake holds bill text for, from its partition names. */
async function lakeSessions() {
  const s3 = new S3Client({ region: "us-east-1" })
  const out = []
  let token
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "lake/v1/text/bill_texts/", ContinuationToken: token }))
    for (const o of r.Contents ?? []) {
      const m = /jurisdiction=([a-z]{2})\/session=(\d+)\//.exec(o.Key)
      if (m) out.push({ state: m[1].toUpperCase(), session: m[2] })
    }
    token = r.NextContinuationToken
  } while (token)
  return out
}

async function stateBills(state, units) {
  const sessions = units ? units.map((session) => ({ state, session })) : (await lakeSessions()).filter((s) => !state || s.state === state)
  for (const s of sessions) {
    if (s.state === "US") continue
    await put({ jurisdiction: jurisdictionOf(s.state), kind: "bill", unit: s.session, priority: PRIORITY.stateBills + (2026 - Number(s.session)) })
  }
}

const juris = value("juris")
const kind = value("kind")
const units = value("units")?.split(",").map((s) => s.trim()) ?? null
const priority = value("priority") === null ? null : Number(value("priority"))
const stateOf = (j) => (j === "us" ? "US" : j.replace(/^us-/, "").toUpperCase())

if (flag("plan")) {
  await federalBills()
  await statutes("US", null, PRIORITY.usc)
  await statutes("NY", null, PRIORITY.nyStatutes)
  const states = (await q(`select distinct state from "Laws" where state not in ('US', 'NY') order by 1`)).map((r) => r.state)
  for (const s of states) await statutes(s, null, PRIORITY.statutes)
  await stateBills(null, null)
} else if (juris && kind === "bill") {
  if (juris === "us") await federalBills(units)
  else await stateBills(stateOf(juris), units)
} else if (juris && kind === "statute") {
  await statutes(stateOf(juris), units, priority ?? (juris === "us" ? PRIORITY.usc : juris === "us-ny" ? PRIORITY.nyStatutes : PRIORITY.statutes))
} else {
  console.error("usage: node scripts/xml/enqueue.mjs --plan | --juris us-ny --kind bill|statute [--units a,b] [--priority n]")
  process.exit(2)
}

if (priority !== null && units) await q(`update xml_jobs set priority = $1 where status = 'queued' and jurisdiction = $2 and kind = $3 and unit = any(string_to_array($4, ',')) returning id`, [priority, juris, kind, units.join(",")])
console.log(`${added} jobs queued, ${kept} already open (run ${RUN})`)
