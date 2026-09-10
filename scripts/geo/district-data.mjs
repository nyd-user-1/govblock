// What a congressional district is worth reading beside its lines
// (2026-09-10): the money its member raised, and the subjects their bills
// are about. Both keyed by the Census GEOID the boundary carries, so the map
// joins them without a lookup table.
//
//   node scripts/geo/district-data.mjs
//
// Money is FecTotals' latest cycle per member. Heat is how many bills the
// member is the primary sponsor of, by CRS policy area — the broad term
// every bill carries exactly one of, so the counts add up to the member's
// whole output.
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const WEB = join(ROOT, "apps/web")
const env = Object.fromEntries(
  readFileSync(join(WEB, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
)
const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })
const sql = async (text) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await client.send(new ExecuteStatementCommand({ resourceArn: env.POLICY_CLUSTER_ARN, secretArn: env.POLICY_SECRET_ARN, database: env.POLICY_DATABASE || "policy", sql: text, includeResultMetadata: true, continueAfterTimeout: true }))
      return (r.records ?? []).map((row) => row.map((f) => Object.values(f)[0]))
    } catch (e) {
      if (/resuming|DatabaseResuming|Throttl/i.test(String(e?.message ?? e)) && attempt < 20) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
}

const FIPS = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56" }

// people_id → geoid, from the sitting House.
const base = process.env.GOVBLOCK_URL || "http://localhost:3000"
const body = await (await fetch(`${base}/api/policy/members?state=US&limit=2000`)).json()
const rows = Array.isArray(body) ? body : (body.rows ?? body.data ?? [])
const geoidOf = new Map()
for (const r of rows) {
  const d = String(r.district ?? "")
  if (r.chamber !== "House" || r.active === false || !d.startsWith("HD-")) continue
  const [, st, num = "0"] = d.split("-")
  const fips = FIPS[st]
  if (!fips) continue
  const n = num.trim()
  geoidOf.set(Number(r.people_id), fips + (n === "0" || n === "AL" || n === "" ? "00" : n.padStart(2, "0")))
}
console.log(`${geoidOf.size} House seats placed`)

// ---- money -----------------------------------------------------------------
const totals = await sql(`
  select distinct on (people_id) people_id, cycle, receipts
  from "FecTotals" where receipts > 0
  order by people_id, cycle desc`)
const money = {}
let cycle = 0
for (const [people_id, cyc, receipts] of totals) {
  const geoid = geoidOf.get(Number(people_id))
  if (!geoid) continue
  money[geoid] = Math.round(Number(receipts))
  cycle = Math.max(cycle, Number(cyc))
}
writeFileSync(join(WEB, "public/geo/cd119-money.json"), JSON.stringify({ source: `FEC totals, latest cycle through ${cycle}`, districts: money }))
console.log(`money: ${Object.keys(money).length} districts`)

// ---- subject heat ----------------------------------------------------------
const counts = await sql(`
  select sp.people_id, s.name, count(*)::int
  from congress_bill_subjects s
  join "Sponsors" sp on sp.bill_id = s.bill_id and sp.position = 1
  where s.is_policy_area
  group by 1, 2`)
const heat = {}
const areaTotals = {}
for (const [people_id, name, n] of counts) {
  const geoid = geoidOf.get(Number(people_id))
  if (!geoid) continue
  ;(heat[geoid] ??= {})[name] = (heat[geoid][name] ?? 0) + Number(n)
  areaTotals[name] = (areaTotals[name] ?? 0) + Number(n)
}
const areas = Object.entries(areaTotals).sort((a, b) => b[1] - a[1]).map(([name]) => name)
writeFileSync(join(WEB, "public/geo/cd119-heat.json"), JSON.stringify({ source: "CRS policy area of every bill its member leads, from the record", areas, districts: heat }))
console.log(`heat: ${Object.keys(heat).length} districts, ${areas.length} policy areas`)
