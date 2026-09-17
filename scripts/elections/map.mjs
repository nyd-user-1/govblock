// The simulator map's views: district shapes and the results drawn on them,
// published only where the two provably belong together.
//
//   python3 scripts/elections/tiger.py download && python3 scripts/elections/tiger.py verify
//   MAPSHAPER_DIR=/path/with/node_modules/mapshaper node --experimental-strip-types scripts/elections/map.mjs [--only NY] [--dry]
//
// Two checks stand between a result and a boundary (Brendan, 2026-09-16):
//   1. The boundary is the one the election was run on. For the House, the
//      Census file of the Congress that election chose. For a legislature,
//      tiger/verified.json: the Census's files from before and after the
//      election agree, and Klarner's plan codes agree with them.
//   2. Every district in the results is a district on that map, by the same
//      key. A state where even one result has no district is left out.
// What passes is written to the public bucket under elections/map/ and listed
// in apps/web/lib/data/elections/map-views.json, which the page carries; the
// page draws nothing that is not listed there.

import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

import { q, WEB } from "../laws/lib/db.mjs"

const require = createRequire(import.meta.url)
const ms = require(join(process.env.MAPSHAPER_DIR ?? "", "node_modules/mapshaper"))
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const s3 = new S3Client({ region: "us-east-1" })
const BUCKET = "govblock-geo-638175140432"
const BASE = `https://${BUCKET}.s3.amazonaws.com`

const argv = process.argv.slice(2)
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null
const dry = argv.includes("--dry")
const TIGER = join(homedir(), "Code/govblock-data/elections/tiger")
const verified = JSON.parse(readFileSync(join(TIGER, "verified.json"), "utf8"))

const FIPS = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" }
const STATE_FIPS = Object.fromEntries(Object.entries(FIPS).map(([f, s]) => [s, f]))

/**
 * One key for a district on both sides. A plain number or number-and-letter
 * ("001", "01A", "12A") is itself without leading zeros; a lone letter
 * ("00A") is the letter; a named district is its letters then its digits, so
 * "1st Barnstable District", "Barnstable 1" and "BARNSTABLE 1" all read
 * barnstable1 and "Bennington-2-1" and "Bennington 2-1" read bennington21.
 */
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]

export function districtKey(raw) {
  let v = String(raw ?? "").trim()
  const letter = v.toUpperCase().match(/^0*([A-Z])$/)
  if (letter) return letter[1]
  const plain = v.toUpperCase().match(/^0*(\d+)([A-Z]?)$/)
  if (plain) return `${Number(plain[1])}${plain[2]}`
  v = v
    .toLowerCase()
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/g, (w) => String(ORDINALS.indexOf(w) + 1))
    .replace(/\b(state|house|senate|senatorial|assembly|legislative|subdistrict|district|county|no|of|and|the|seat|position)\b/g, " ")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
  const letters = v.replace(/[^a-z]/g, "")
  const digits = v.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "")
  if (!letters) return digits || null
  return `${letters}${digits}`
}

async function shapes(files, filter, fields) {
  const dir = join(tmpdir(), `gb-map-${process.pid}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  for (const f of files) execFileSync("unzip", ["-q", "-o", f, "-d", dir])
  const shp = readdirSync(dir).filter((n) => n.endsWith(".shp")).map((n) => join(dir, n))
  const input = shp.length > 1 ? `-i combine-files ${shp.map((s) => `"${s}"`).join(" ")} -merge-layers force` : `-i "${shp[0]}"`
  const out = await ms.applyCommands(`${input} -filter "${filter}" -proj wgs84 -simplify 4% keep-shapes -filter-fields ${fields} -o format=geojson precision=0.0001 out.geojson`, {})
  rmSync(dir, { recursive: true, force: true })
  return JSON.parse(out["out.geojson"])
}

async function put(key, body, type = "application/json") {
  if (dry) return
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: gzipSync(typeof body === "string" ? body : JSON.stringify(body)), ContentType: type, ContentEncoding: "gzip", CacheControl: "public, max-age=86400" }))
}

/** A state's regular November races for one office and year, with their candidates. */
async function results(year, state, office, source) {
  const races = await q(
    `select district, seats, contested, margin, winners::text as winners, winner_party, winner_share, total_votes, open_seat from election_races
      where source = $1 and year = $2 and state = $3 and office = $4 and stage = 'GEN' and not special`,
    [source, year, state, office]
  )
  const cands = await q(
    `select district, candidate, party, sum(votes)::bigint as votes from election_results
      where source = $1 and year = $2 and state = $3 and office = $4 and stage = 'GEN' and not special
      group by 1, 2, 3`,
    [source, year, state, office]
  )
  const byDistrict = new Map()
  for (const c of cands) {
    if (/^(scattering|write-?ins?|other|blanks?|void)/i.test(c.candidate)) continue
    if (!byDistrict.has(c.district)) byDistrict.set(c.district, new Map())
    const people = byDistrict.get(c.district)
    const p = people.get(c.candidate) ?? { name: c.candidate, party: "", votes: 0 }
    p.votes += Number(c.votes) || 0
    if (/^DEM/i.test(c.party)) p.party = "D"
    else if (/^REP/i.test(c.party)) p.party = "R"
    else if (!p.party) p.party = c.party
    people.set(c.candidate, p)
  }
  const out = {}
  for (const r of races) {
    // A race filed with no district at all (a stray write-in line) belongs to no seat.
    if (!String(r.district).trim()) continue
    let [base, post] = String(r.district).split("/")
    let key = districtKey(base)
    if (!key) return { error: `district "${r.district}" has no key` }
    // Idaho's seats filed as "A1", "B1": district 1, seat A and seat B.
    const seat = key.match(/^([a-z])(\d+)$/)
    if (seat) {
      key = seat[2]
      post = seat[1].toUpperCase()
    }
    const winners = String(r.winners ?? "").replace(/^\{|\}$/g, "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((w) => w.replace(/^"|"$/g, "")).filter(Boolean)
    const people = [...(byDistrict.get(r.district)?.values() ?? [])].sort((a, b) => b.votes - a.votes)
    ;(out[key] ??= []).push({
      post: post ?? null,
      seats: Number(r.seats),
      contested: r.contested === true || r.contested === "true",
      margin: r.margin === null ? null : Number(r.margin),
      share: r.winner_share === null ? null : Number(r.winner_share),
      open: r.open_seat === null ? null : r.open_seat === true || r.open_seat === "true",
      winners: winners.map((w) => ({ name: w, party: people.find((p) => p.name === w)?.party ?? "" })),
      candidates: people.slice(0, 8),
    })
  }
  return { districts: out }
}

const manifest = { rule: verified.rule, house: [], legislatures: [], left_out: [] }

// ---- the House, by Congress ------------------------------------------------
// The 118th Congress's files carry the 2020 census's field names (STATEFP20).
const CONGRESS = [
  [2012, 113, "CD113FP", "STATEFP", "GEOID"],
  [2014, 114, "CD114FP", "STATEFP", "GEOID"],
  [2016, 115, "CD115FP", "STATEFP", "GEOID"],
  [2018, 116, "CD116FP", "STATEFP", "GEOID"],
  [2022, 118, "CD118FP", "STATEFP20", "GEOID20"],
  [2024, 119, "CD119FP", "STATEFP", "GEOID"],
]
for (const [year, congress, field, stateField, geoidField] of CONGRESS) {
  const files = readdirSync(join(TIGER, "cd", String(congress))).filter((f) => f.endsWith(".zip")).map((f) => join(TIGER, "cd", String(congress), f))
  const fc = await shapes(files, `!['11', '72', '60', '66', '69', '78'].includes(${stateField}) && ${field} != 'ZZ'`, `${stateField},${field},${geoidField}`)
  const shapeKeys = new Map()
  for (const f of fc.features) {
    const state = FIPS[f.properties[stateField]]
    const n = String(Number(f.properties[field]))
    const key = `${state}-${n}`
    f.properties = { key, state, district: n, geoid: f.properties[geoidField] }
    shapeKeys.set(key, f)
  }
  const view = { year, congress, shapes: `${BASE}/elections/map/house/${year}.geojson`, results: `${BASE}/elections/map/house/${year}.results.json`, states: [] }
  const all = {}
  for (const state of Object.values(FIPS)) {
    if (only && !only.includes(state)) continue
    const r = await results(year, state, "US HOUSE", "medsl-house")
    if (r.error || !r.districts || !Object.keys(r.districts).length) {
      manifest.left_out.push({ office: "US HOUSE", year, state, why: r.error ?? "no results" })
      continue
    }
    const missing = Object.keys(r.districts).filter((k) => !shapeKeys.has(`${state}-${k}`))
    if (missing.length) {
      manifest.left_out.push({ office: "US HOUSE", year, state, why: `results for districts ${missing.join(", ")} have no district on the ${congress}th Congress's map` })
      continue
    }
    for (const [k, v] of Object.entries(r.districts)) all[`${state}-${k}`] = v
    view.states.push(state)
  }
  fc.features = fc.features.filter((f) => view.states.includes(f.properties.state))
  await put(`elections/map/house/${year}.geojson`, fc, "application/geo+json")
  await put(`elections/map/house/${year}.results.json`, all)
  manifest.house.push(view)
  console.log(`House ${year} (${congress}th): ${view.states.length} states`)
}

// ---- state legislatures ------------------------------------------------------
for (const [yearText, states] of Object.entries(verified.legislatures)) {
  const year = Number(yearText)
  const source = year === 2024 ? "medsl-state-2024" : "klarner"
  for (const [state, offices] of Object.entries(states)) {
    if (only && !only.includes(state)) continue
    for (const [office, check] of Object.entries(offices)) {
      if (!check.verified) {
        if (check.why !== "no election in this chamber this year") manifest.left_out.push({ office, year, state, why: `boundaries: ${check.why}` })
        continue
      }
      const r = await results(year, state, office, source)
      if (r.error || !r.districts || !Object.keys(r.districts).length) {
        if (r.error) manifest.left_out.push({ office, year, state, why: r.error })
        continue
      }
      const kind = office === "STATE SENATE" ? "sldu" : "sldl"
      const code = kind === "sldu" ? "SLDUST" : "SLDLST"
      const zip = join(TIGER, "sld", String(year), `tl_${year}_${STATE_FIPS[state]}_${kind}.zip`)
      const fc = await shapes([zip], `!/^Z+$/.test(${code})`, `${code},NAMELSAD,GEOID`)
      const byKey = new Map()
      let duplicate = null
      // Where the results name their districts ("Belknap 1"), the Census's own
      // numbering (001) means nothing without the name, so the name is the key.
      const named = Object.keys(r.districts).some((k) => /[a-z]/.test(k))
      for (const f of fc.features) {
        const numeric = !named && /^0*\d+[A-Z]?$|^0*[A-Z]$/.test(f.properties[code])
        let key = districtKey(numeric ? f.properties[code] : f.properties.NAMELSAD)
        // Vermont's Grand Isle senate district takes in part of Chittenden County;
        // the Census names it for both, Klarner and MIT for Grand Isle alone. Only
        // the Senate: the House has a Grand Isle-Chittenden district of its own.
        if (state === "VT" && office === "STATE SENATE" && key === "grandislechittenden") key = "grandisle"
        if (byKey.has(key)) duplicate = key
        byKey.set(key, f)
        f.properties = { key, name: f.properties.NAMELSAD, geoid: f.properties.GEOID }
      }
      const missing = Object.keys(r.districts).filter((k) => !byKey.has(k))
      if (duplicate || missing.length) {
        manifest.left_out.push({ office, year, state, why: duplicate ? `two districts share the key ${duplicate}` : `results for ${missing.length} districts (${missing.slice(0, 4).join(", ")}) have no district on the map`, map_keys: JSON.stringify([...byKey.keys()].filter((k) => !Object.hasOwn(r.districts, k)).slice(0, 8)) })
        continue
      }
      const slug = `${state.toLowerCase()}-${kind === "sldu" ? "senate" : "house"}`
      await put(`elections/map/legislatures/${year}/${slug}.geojson`, fc, "application/geo+json")
      await put(`elections/map/legislatures/${year}/${slug}.results.json`, r.districts)
      manifest.legislatures.push({ year, state, office, shapes: `${BASE}/elections/map/legislatures/${year}/${slug}.geojson`, results: `${BASE}/elections/map/legislatures/${year}/${slug}.results.json`, districts: fc.features.length, races: Object.keys(r.districts).length })
    }
  }
  console.log(`legislatures ${year}: ${manifest.legislatures.filter((v) => v.year === year).length} views`)
}

const why = manifest.left_out.reduce((m, l) => ((m[l.why.split(":")[0].replace(/\d+/g, "#")] = (m[l.why.split(":")[0].replace(/\d+/g, "#")] ?? 0) + 1), m), {})
console.log(`left out: ${manifest.left_out.length}`, why)
if (argv.includes("--debug")) for (const l of manifest.left_out.filter((l) => !/^boundaries/.test(l.why))) console.log(l.year, l.state, l.office, l.why, l.map_keys ?? "")
if (!dry) {
  mkdirSync(join(WEB, "lib/data/elections"), { recursive: true })
  writeFileSync(join(WEB, "lib/data/elections/map-views.json"), JSON.stringify(manifest) + "\n")
  console.log("apps/web/lib/data/elections/map-views.json written")
}
