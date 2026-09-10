// Sitting members by district, one file per state chamber, beside the
// chamber's boundary file (2026-09-10): /geo/<id>-members.json, keyed by the
// Census GEOID the boundary carries (state FIPS + three-digit district), so
// a point that lands in a district can name who sits for it.
//
//   node scripts/geo/members.mjs            every chamber in the manifest, from the dev server on :3000
//   node scripts/geo/members.mjs --only NY
//
// Reads the record through /api/policy/members, which carries LegiScan's
// district strings — "SD-015" for the upper house, "HD-078" for the lower —
// and the manifest lib/map/state-districts.ts for which files exist.
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const WEB = join(ROOT, "apps/web")
const BASE = process.env.GOVBLOCK_URL || "http://localhost:3000"
const only = (() => {
  const i = process.argv.indexOf("--only")
  return i >= 0 ? new Set(process.argv[i + 1].split(",").map((s) => s.trim().toUpperCase())) : null
})()

const FIPS = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56", PR: "72" }

// The manifest, read as text: it is generated TS, and the shape is plain.
const manifest = readFileSync(join(WEB, "lib/map/state-districts.ts"), "utf8")
const entries = [...manifest.matchAll(/code: "([A-Z]{2})",\s*chambers: \[([\s\S]*?)\],?\s*\}/g)].map((m) => ({
  code: m[1],
  chambers: [...m[2].matchAll(/id: "([^"]+)",\s*chamber: "([^"]+)",\s*rank: "(upper|lower)"/g)].map((c) => ({ id: c[1], chamber: c[2], rank: c[3] })),
}))
if (!entries.length) throw new Error("no chambers read from lib/map/state-districts.ts")

// A district's name, as the record writes it and as the Census writes it,
// brought to one spelling: lower case, leading zeros gone, county
// abbreviations spelled out, punctuation dropped. "HD-001A" and "1A" meet at
// "1a"; "HD-01-BEL" and "Belknap 01" meet at "belknap1".
const COUNTY = {
  NH: { BEL: "Belknap", CAR: "Carroll", CHE: "Cheshire", COO: "Coos", GRA: "Grafton", HIL: "Hillsborough", MER: "Merrimack", ROC: "Rockingham", STR: "Strafford", SUL: "Sullivan" },
  MA: { BAR: "Barnstable", BER: "Berkshire", BRI: "Bristol", ESS: "Essex", FRA: "Franklin", HAM: "Hampden", HAS: "Hampshire", MID: "Middlesex", NAN: "Nantucket", NOR: "Norfolk", PLY: "Plymouth", SUF: "Suffolk", WOR: "Worcester", DUK: "Dukes" },
  VT: { ADD: "Addison", BEN: "Bennington", CAL: "Caledonia", CHI: "Chittenden", ESS: "Essex", FRA: "Franklin", GI: "Grand Isle", LAM: "Lamoille", ORA: "Orange", ORL: "Orleans", RUT: "Rutland", WAS: "Washington", WDH: "Windham", WDR: "Windsor" },
}
const ORDINAL = /^(\d+)(st|nd|rd|th)\b/i
function norm(text, code) {
  const counties = COUNTY[code] ?? {}
  const raw = String(text ?? "").trim().replace(ORDINAL, "$1")
  // Tokens first, letters apart from digits: "ADD1" is a county and a number,
  // not a word. Then a county code becomes the county, and the tokens are
  // sorted, so "01-BEL" and "Belknap 01" meet at the same string.
  const tokens = (raw.match(/[A-Za-z]+|\d+/g) ?? []).map((x) => {
    if (/^\d+$/.test(x)) return String(Number(x))
    return (counties[x.toUpperCase()] ?? x).toLowerCase()
  })
  return tokens.sort().join("")
}

let files = 0
for (const { code, chambers } of entries) {
  if (only && !only.has(code)) continue
  const fips = FIPS[code]
  if (!fips) continue
  const res = await fetch(`${BASE}/api/policy/members?state=${code}&limit=2000`)
  const body = await res.json()
  const rows = Array.isArray(body) ? body : (body.rows ?? body.data ?? [])
  const upper = chambers.find((c) => c.rank === "upper")
  const lower = chambers.find((c) => c.rank === "lower")
  // Each chamber's districts as the Census names them, by normalized name.
  const lookup = {}
  for (const c of chambers) {
    const fc = JSON.parse(readFileSync(join(WEB, "public/geo", `${c.id}.geojson`), "utf8"))
    lookup[c.id] = new Map(fc.features.map((f) => [norm(f.properties.district, code), f.properties.geoid]))
  }
  const out = {}
  for (const c of chambers) out[c.id] = {}
  let seated = 0
  for (const r of rows) {
    if (r.active === false) continue
    const d = String(r.district ?? "")
    const m = d.match(/^(SD|HD)-(.+)$/)
    if (!m) continue
    const target = m[1] === "SD" ? (upper ?? lower) : (lower ?? upper)
    if (!target) continue
    const key = norm(m[2].replace(/^0+(?=\d)/, ""), code)
    const table = lookup[target.id]
    // A seat letter on a numbered district (WA's 1A and 1B) is a position, not a district.
    const geoid = table.get(key) ?? table.get(key.replace(/[a-z]$/, "")) ?? null
    if (!geoid) continue
    ;(out[target.id][geoid] ??= []).push({ name: r.name, party: r.party ?? null, people_id: r.people_id ?? null })
    seated++
  }
  for (const c of chambers) {
    const n = Object.keys(out[c.id]).length
    writeFileSync(join(WEB, "public/geo", `${c.id}-members.json`), JSON.stringify({ source: `the record, ${new Date().toISOString().slice(0, 10)}`, chamber: c.chamber, districts: out[c.id] }))
    files++
    console.log(`${code} ${c.chamber}: ${n} of ${lookup[c.id].size} districts seated`)
  }
}
console.log(`${files} files written`)
