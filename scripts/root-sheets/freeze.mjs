#!/usr/bin/env node
// The root's right-hand sheets, frozen (Brendan, 2026-09-20): the changelog
// and the account home behind the Map are a demonstration, not a working
// page, so what they show is read here once from the site's own API and
// written to apps/web/lib/data/root-sheets.json. The sheets draw that file
// and ask the API nothing.
//
//   node scripts/root-sheets/freeze.mjs                  from policy.nysgpt.com
//   node scripts/root-sheets/freeze.mjs http://localhost:3001
import { writeFileSync } from "node:fs"

const origin = (process.argv[2] || "https://policy.nysgpt.com").replace(/\/$/, "")
const OUT = new URL("../../apps/web/lib/data/root-sheets.json", import.meta.url)

// The changelog's sheet: this many bills, each text cut to this many lines.
const BILLS = 12
const TEXT_LINES = 80
const STATE_BATCH = 6
const CONGRESS = "US"
const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")
// The account home's tiles: every metric over every window its menu offers.
const METRICS = ["votes", "introduced", "engrossed", "passed", "vetoed", "hearings-scheduled", "hearings-held", "actions", "amendments"]
const DAYS = [7, 30, 90, 365]

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))
const read = async (path) => {
  const response = await fetch(origin + path, { headers: { "user-agent": "Mozilla/5.0 (govblock freeze)" } })
  if (!response.ok) throw new Error(`${response.status} ${path}`)
  return response.json()
}

// Each jurisdiction's newest bill, Congress first and the states newest first, as the /changelog page orders them. A bill with no text on file makes a poor exhibit, so it is the newest with text, looked for this deep.
const DEPTH = 8
const byDate = (a, b) => ((a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1)
const groups = (await Promise.all(chunk([CONGRESS, ...STATES], STATE_BATCH).map((states) => read(`/api/policy/stream?states=${states.join(",")}&limit=${DEPTH}`)))).flat()
const newest = groups
  .flatMap((group) => group.bills.filter((bill) => bill.text_chars > 0).sort(byDate).slice(0, 1).map((bill) => ({ ...bill, state: group.state, session: group.session })))
  .sort((a, b) => (a.state === CONGRESS ? -1 : b.state === CONGRESS ? 1 : (a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1))
const entries = newest.slice(0, BILLS)
const bodies = await read(`/api/policy/bill-texts?ids=${entries.map((bill) => bill.bill_id).join(",")}`)
const texts = Object.fromEntries(Object.entries(bodies).map(([id, text]) => [id, String(text).replace(/\r/g, "").split("\n").slice(0, TEXT_LINES).join("\n")]))

// Keyed by the URL the tiles ask for, less the refresh button's nonce.
const home = {}
const paths = ["/api/policy/committees?state=US&limit=300", ...METRICS.flatMap((metric) => DAYS.map((days) => `/api/policy/metric?state=US&metric=${metric}&days=${days}`))]
for (const batch of chunk(paths, 6)) {
  const answers = await Promise.all(batch.map((path) => read(path).catch(() => null)))
  batch.forEach((path, i) => answers[i] !== null && (home[path] = answers[i]))
}

writeFileSync(OUT, JSON.stringify({ frozen: new Date().toISOString().slice(0, 10), changelog: { entries, texts }, home }) + "\n")
console.log(`${entries.length} bills, ${Object.keys(texts).length} texts, ${Object.keys(home).length} home answers → ${OUT.pathname}`)
