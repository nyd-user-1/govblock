#!/usr/bin/env node
// The data sets that ship beside the registry's cards (Brendan, 2026-09-12:
// "ship the data with the component"). Each is a page of real rows read from
// the site's own public API — the same routes the cards read live — written
// to apps/web/registry/data/<name>.json, which the registry serves as the
// item <name>-data at lib/44gov/data/<name>.json in a consumer's tree.
//
//   node scripts/registry/data.mjs          refresh every set
//   node scripts/registry/data.mjs votes    one set
import fs from "node:fs"
import path from "node:path"

const ORIGIN = process.env.GOVBLOCK_ORIGIN ?? "https://gov.nysgpt.com"
const out = path.resolve(import.meta.dirname, "../../apps/web/registry/data")
fs.mkdirSync(out, { recursive: true })

const get = async (p) => {
  const r = await fetch(`${ORIGIN}${p}`, { headers: { "user-agent": "GovBlock/1.0 registry-data (+https://gov.nysgpt.com)" } })
  if (!r.ok) throw new Error(`${p}: ${r.status}`)
  return r.json()
}

const SETS = {
  // Congress, the current session, as the home page shows it.
  votes: async () => get("/api/policy/rollcalls?state=US&limit=12"),
  committees: async () => {
    const rows = await get("/api/policy/committees?state=US")
    return [...rows].sort((a, b) => b.bills - a.bills).slice(0, 24).map((c) => ({ label: c.committee_name, bills: c.bills, chamber: c.chamber }))
  },
  sessions: async () => {
    const rows = await get("/api/policy/sessions?state=US&titles=1")
    return rows.map((r) => ({ session_year: r.session_id, label: r.title, years: r.title.match(/\d{4}-\d{4}/)?.[0] ?? String(r.session_id), bills: r.bills }))
  },
  topics: async () => (await get("/api/policy/subjects?state=US")).slice(0, 24).map((r) => ({ label: r.value, bills: r.count })),
  seats: async () => get("/api/policy/seats?state=US"),
  members: async () => {
    const [rows, detail] = await Promise.all([get("/api/policy/members?state=US"), get("/api/policy/member-detail?state=US").catch(() => ({ members: [] }))])
    const held = new Map((detail.members ?? []).filter((p) => p.portrait_url).map((p) => [String(p.bioguide_id).toUpperCase(), p.portrait_url]))
    const list = (Array.isArray(rows) ? rows : (rows.rows ?? [])).filter((m) => m.active !== false)
    const photo = (m) => (m.bioguide_id ? (held.get(String(m.bioguide_id).toUpperCase()) ?? null) : (m.photo_url ?? null))
    return [...list.filter((m) => photo(m)), ...list.filter((m) => !photo(m))].slice(0, 36).map((m) => ({ people_id: m.people_id, name: m.name, party: m.party, role: m.role ?? null, chamber: m.chamber, photo: photo(m), serving: m.serving ?? true }))
  },
  // The statuses for every bill, and for each chamber's own bills, so a
  // standalone card can fold the chamber the reader picks rather than fold
  // the whole session under a chamber's name (a reviewer caught 10,753 House
  // committee bills reading as Senate bills "crossed over", 2026-09-12).
  "bill-stages": async () => {
    const slice = async (chamber) => {
      const q = chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""
      const [options, bills] = await Promise.all([get(`/api/policy/options?state=US${q}`), get(`/api/policy/bills?state=US&limit=1${q}`)])
      return { statuses: options.statuses, total: bills.total ?? options.statuses.reduce((s, r) => s + r.count, 0) }
    }
    const [all, house, senate] = await Promise.all([slice(null), slice("House"), slice("Senate")])
    return { ...all, chambers: { House: house, Senate: senate } }
  },
  chambers: async () => {
    const [options, seats] = await Promise.all([get("/api/policy/options?state=US"), get("/api/policy/seats?state=US")])
    const members = new Map()
    for (const row of seats) members.set(row.chamber, (members.get(row.chamber) ?? 0) + row.seats)
    return options.chambers.map((c) => ({ label: c.value, bills: c.count, members: members.get(c.value) ?? 0 }))
  },
  "bills-by-party": async () => (await get("/api/policy/bills-by-party?state=US&months=6")).rows,
  adopted: async () => get("/api/policy/adopted?state=US"),
  bills: async () => (await get("/api/policy/bills?state=US&limit=25")).rows,
  "bill-redline": async () => get("/api/policy/bill-compare?state=US&bill=2154287"),
  "bill-text": async () => {
    const texts = await get("/api/policy/texts?state=US&id=2058568")
    const first = (texts.rows ?? texts).filter((t) => !/memo|summary/i.test(t.version ?? "")).sort((a, b) => a.document_id - b.document_id)[0]
    const doc = await get(`/api/policy/text?state=US&id=2058568&document=${first.document_id}`)
    return { bill_id: 2058568, bill_number: "HB6644", version: first.version, date: first.date ?? null, text: doc.text }
  },
}

const wanted = process.argv.slice(2)
const names = wanted.length ? wanted : Object.keys(SETS)
let failed = 0
for (const name of names) {
  const fn = SETS[name]
  if (!fn) {
    console.error(`no such set: ${name}`)
    failed++
    continue
  }
  try {
    const data = await fn()
    const file = path.join(out, `${name}.json`)
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
    const n = Array.isArray(data) ? data.length : Object.keys(data).length
    console.log(`${name.padEnd(16)} ${String(n).padStart(4)} ${Array.isArray(data) ? "rows" : "keys"}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
  } catch (e) {
    failed++
    console.error(`${name}: ${e.message}`)
  }
}
process.exit(failed ? 1 : 0)
