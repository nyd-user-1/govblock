#!/usr/bin/env node
// Every state's legislative districts, from the Census, on the pattern the
// two New York files set (2026-09-09). TIGERweb's Legislative service draws
// the 2026 lines: layer 1 is each state's upper chamber, layer 2 its lower.
// Nebraska seats one house and the Census files it as upper; the District's
// eight Council wards are filed the same way and have no lower layer at all.
//
//   node scripts/geo/state-districts.mjs            # all of them
//   node scripts/geo/state-districts.mjs --only=NY,TX
//   node scripts/geo/state-districts.mjs --offset=0.006
//
// It writes apps/web/public/geo/<code>-<senate|house>.geojson, regenerates
// apps/web/lib/map/state-districts.ts from what it wrote, and prints the
// per-file table. A file that lands over the budget is drawn again at a
// coarser offset until it fits, and the table says so.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const GEO_DIR = path.join(ROOT, "apps/web/public/geo")
const MANIFEST = path.join(ROOT, "apps/web/lib/map/state-districts.ts")

const SERVICE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer"
const UPPER = 1
const LOWER = 2

/** What the map will carry over the wire, per file. Over this and it is drawn again. */
const BUDGET = 600 * 1024
/** Degrees of generalization, and the coarser ones a fat file falls back through. */
const OFFSETS = [0.003, 0.006, 0.012, 0.024]
/** Four decimals is ~11 m — finer than the generalization, so nothing is lost. */
const PRECISION = 4
/** One request at a time, with a breath between: this is a public service. */
const PAUSE_MS = 250
const PAGE = 1000

// The jurisdictions the record files by, by the FIPS the Census draws by.
// Territories other than Puerto Rico have no legislative layer here.
const FIPS_TO_STATE = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "72": "PR",
}

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
}

// Five states seat an Assembly; everyone else a House. `lib/filters.ts` is the
// app's copy of this — a script outside the app cannot import a TS module.
const ASSEMBLY_STATES = new Set(["CA", "NV", "NJ", "NY", "WI"])
const lowerChamber = (code) => (ASSEMBLY_STATES.has(code) ? "Assembly" : "House")

/** What the body is really called, and what its file is called. */
function chamberOf(code, layer) {
  if (code === "NE") return { chamber: "Legislature", suffix: "legislature" }
  if (code === "DC") return { chamber: "Council", suffix: "council" }
  if (layer === UPPER) return { chamber: "Senate", suffix: "senate" }
  return { chamber: lowerChamber(code), suffix: "house" }
}

// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** One request, retried on a 5xx or a dropped socket — the service is busy, not broken. */
async function ask(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } })
      if (response.status >= 500 && attempt < tries) {
        await sleep(1000 * attempt)
        continue
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const body = await response.json()
      if (body.error) throw new Error(`${body.error.code}: ${body.error.message}`)
      return body
    } catch (error) {
      if (attempt >= tries) throw error
      await sleep(1000 * attempt)
    }
  }
}

const query = (layer, params) =>
  `${SERVICE}/${layer}/query?${new URLSearchParams(params)}`

/** How many districts each state has on a layer, in one grouped count. */
async function census(layer) {
  const body = await ask(
    query(layer, {
      where: "1=1",
      groupByFieldsForStatistics: "STATE",
      outStatistics: JSON.stringify([
        { statisticType: "count", onStatisticField: "GEOID", outStatisticFieldName: "n" },
      ]),
      f: "json",
    })
  )
  return new Map(body.features.map((f) => [f.attributes.STATE, f.attributes.n]))
}

/** A state's districts, paged until the expected count is in hand. */
async function districts(layer, fips, expected, offset) {
  const features = []
  for (let cursor = 0; cursor < expected; ) {
    const page = await ask(
      query(layer, {
        where: `STATE='${fips}'`,
        outFields: "GEOID,STATE,BASENAME,NAME",
        returnGeometry: "true",
        outSR: "4326",
        maxAllowableOffset: String(offset),
        geometryPrecision: String(PRECISION),
        resultOffset: String(cursor),
        resultRecordCount: String(PAGE),
        orderByFields: "GEOID",
        f: "geojson",
      })
    )
    const got = page.features ?? []
    if (!got.length) break
    features.push(...got)
    cursor += got.length
    if (cursor < expected) await sleep(PAUSE_MS)
  }
  return features
}

/** Only what the map reads: five strings, in the order the New York files carry them. */
const slim = (feature, chamber) => {
  const p = feature.properties
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      geoid: p.GEOID,
      state: p.STATE,
      district: p.BASENAME,
      name: p.NAME,
      chamber,
    },
  }
}

// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=")
    return [k, v ?? true]
  })
)
const only = args.only
  ? new Set(String(args.only).toUpperCase().split(","))
  : null
const startOffset = args.offset ? Number(args.offset) : OFFSETS[0]

async function main() {
  await mkdir(GEO_DIR, { recursive: true })
  const counts = { [UPPER]: await census(UPPER), [LOWER]: await census(LOWER) }
  const rows = []

  for (const [fips, code] of Object.entries(FIPS_TO_STATE)) {
    if (only && !only.has(code)) continue
    for (const layer of [UPPER, LOWER]) {
      const expected = counts[layer].get(fips)
      if (!expected) continue
      const { chamber, suffix } = chamberOf(code, layer)
      const file = `${code.toLowerCase()}-${suffix}.geojson`

      let offset = startOffset
      let bytes = Infinity
      let json = ""
      let features = []
      for (const step of OFFSETS.filter((o) => o >= startOffset)) {
        offset = step
        features = await districts(layer, fips, expected, offset)
        json = JSON.stringify({
          type: "FeatureCollection",
          features: features.map((f) => slim(f, chamber)),
        })
        bytes = Buffer.byteLength(json)
        if (bytes <= BUDGET) break
        await sleep(PAUSE_MS)
      }

      await writeFile(path.join(GEO_DIR, file), json)
      rows.push({
        code, chamber, file, offset, bytes,
        count: features.length,
        expected,
        short: features.length < expected,
      })
      console.error(
        `${code} ${chamber}: ${features.length}/${expected} → ${file} ` +
          `${(bytes / 1024).toFixed(0)} KB @ ${offset}` +
          (features.length < expected ? "  ** short **" : "")
      )
      await sleep(PAUSE_MS)
    }
  }

  await writeManifest()
  table(rows)
}

/** The map's index of what is on disk, read back from the directory so the
    two cannot drift — a run over one state still leaves the whole index right. */
async function writeManifest() {
  const files = (await readdir(GEO_DIR))
    .map((f) => /^([a-z]{2})-(senate|house|legislature|council)\.geojson$/.exec(f))
    .filter(Boolean)
  const byState = new Map()
  for (const [file, lower, suffix] of files) {
    const code = lower.toUpperCase()
    if (!STATE_NAMES[code]) continue
    const fc = JSON.parse(await readFile(path.join(GEO_DIR, file), "utf8"))
    const chamber =
      suffix === "legislature"
        ? "Legislature"
        : suffix === "council"
          ? "Council"
          : suffix === "senate"
            ? "Senate"
            : lowerChamber(code)
    const list = byState.get(code) ?? []
    list.push({
      id: file.replace(/\.geojson$/, ""),
      chamber,
      rank: suffix === "house" ? "lower" : "upper",
      file: `/geo/${file}`,
      count: fc.features.length,
    })
    byState.set(code, list)
  }
  const codes = [...byState.keys()].sort((a, b) =>
    STATE_NAMES[a].localeCompare(STATE_NAMES[b])
  )
  const entries = codes.map((code) => {
    const chambers = byState
      .get(code)
      .sort((a, b) => (a.rank === b.rank ? 0 : a.rank === "upper" ? -1 : 1))
      .map(
        (c) =>
          `      { id: "${c.id}", chamber: "${c.chamber}", rank: "${c.rank}", ` +
          `file: "${c.file}", count: ${c.count} },`
      )
    return [
      `  {`,
      `    code: "${code}",`,
      `    chambers: [`,
      ...chambers,
      `    ],`,
      `  },`,
    ].join("\n")
  })
  const source = `// Generated by scripts/geo/state-districts.mjs — do not edit by hand.
//
// One entry per jurisdiction with district files under /geo, each chamber by
// the name it goes by: a Senate and a House or Assembly, Nebraska's single
// Legislature, the District's Council. \`rank\` is what the line is coloured
// by, so every state's upper chamber reads the same green and every lower
// the same amber. \`count\` is what the file holds, for the legend.

export type ChamberRank = "upper" | "lower"

export type StateChamber = {
  /** The overlay's id, and the file's name without its extension. */
  id: string
  chamber: string
  rank: ChamberRank
  file: string
  count: number
}

export type StateDistricts = { code: string; chambers: readonly StateChamber[] }

export const STATE_DISTRICTS = [
${entries.join("\n")}
] as const satisfies readonly StateDistricts[]

/** The two colours the legend reads the same way in every state. */
export const RANK_COLOR: Record<ChamberRank, string> = {
  upper: "#059669",
  lower: "#d97706",
}

export type StateOverlayId = (typeof STATE_DISTRICTS)[number]["chambers"][number]["id"]

const BY_ID = new Map<string, { state: StateDistricts; chamber: StateChamber }>(
  STATE_DISTRICTS.flatMap((state) =>
    state.chambers.map((chamber) => [chamber.id, { state, chamber }] as const)
  )
)

export const stateChamber = (id: string) => BY_ID.get(id)
export const chambersOfState = (code: string) =>
  STATE_DISTRICTS.find((s) => s.code === code)?.chambers ?? []
`
  await writeFile(MANIFEST, source)
}

/** The report's table, on stdout, so a run can be pasted into the log. */
function table(rows) {
  const head = ["State", "Chamber", "File", "Districts", "Size", "Offset"]
  const body = [...rows]
    .sort(
      (a, b) =>
        STATE_NAMES[a.code].localeCompare(STATE_NAMES[b.code]) ||
        (a.chamber === lowerChamber(a.code) ? 1 : 0) -
          (b.chamber === lowerChamber(b.code) ? 1 : 0)
    )
    .map((r) => [
      STATE_NAMES[r.code],
      r.chamber,
      r.file,
      String(r.count) + (r.short ? ` of ${r.expected}` : ""),
      `${(r.bytes / 1024).toFixed(0)} KB`,
      r.offset === OFFSETS[0] ? "0.003" : `${r.offset} (redrawn)`,
    ])
  const widths = head.map((h, i) =>
    Math.max(h.length, ...body.map((r) => r[i].length))
  )
  const line = (cells) =>
    "| " + cells.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |"
  console.log(line(head))
  console.log("|-" + widths.map((w) => "-".repeat(w)).join("-|-") + "-|")
  for (const r of body) console.log(line(r))
  const total = rows.reduce((n, r) => n + r.bytes, 0)
  console.log(
    `\n${rows.length} files, ${rows.reduce((n, r) => n + r.count, 0)} districts, ` +
      `${(total / 1024 / 1024).toFixed(1)} MB on disk.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
