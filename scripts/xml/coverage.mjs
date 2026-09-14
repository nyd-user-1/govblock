// Coverage, measured (program brief, "The compiler"): a sample of a
// jurisdiction's stored documents through its front end, and the share that
// parses cleanly into the USLM vocabulary, with the elements it did not
// know. Writes one line per jurisdiction to
// apps/web/lib/xml/coverage.generated.json, which the Compiler page reads.
//
//   node scripts/xml/coverage.mjs US [--sample 40] [--source documents|texts|laws]
//
// `documents` samples Documents rows whose url ends in .xml and fetches them
// (federal, GovInfo); `texts` samples BillTexts.text; `laws` samples Laws.text.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { q } from "../laws/lib/db.mjs"
import { load, WEB } from "./bundle.mjs"
import { NOT_A_PRINTING } from "./sources/printings.mjs"

const [jurisdiction = "US", ...rest] = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : fallback
}
const sample = Number(arg("sample", 40))
const source = arg("source", jurisdiction === "US" ? "documents" : "texts")
const OUT = join(WEB, "lib/xml/coverage.generated.json")

const { frontEndFor } = await load("lib/xml/frontends/index.ts")
const fe = frontEndFor(jurisdiction)

async function sources() {
  const state = jurisdiction.toUpperCase()
  if (source === "documents") {
    const rows = await q(`select d.url from "Documents" d join "Bills" b on b.bill_id = d.bill_id where b.state = $1 and d.url ilike '%.xml%' order by random() limit $2`, [state, sample])
    const out = []
    for (const r of rows) {
      try {
        const res = await fetch(r.url, { headers: { "user-agent": "govblock (+https://gov.nysgpt.com)" } })
        if (!res.ok) {
          out.push({ kind: "xml", body: "", url: r.url, failed: `HTTP ${res.status}` })
          continue
        }
        out.push({ kind: "xml", body: await res.text(), url: r.url })
      } catch (e) {
        out.push({ kind: "xml", body: "", url: r.url, failed: String(e?.message ?? e) })
      }
    }
    return out
  }
  // The population the pipeline compiles, so the sampled number and the stored one agree: every
  // leaf section with text (Oregon's and Kansas's history-note stubs are a third of their codes),
  // every printing of every session. Rows come without their text and each text is read on its
  // own, in slices, so a long document never passes the Data API's megabyte.
  const sliced = async (sql, params, chars) => {
    const parts = []
    for (let from = 1; from <= Number(chars); from += 200_000) parts.push((await q(sql, [...params, from]))[0]?.part ?? "")
    return parts.join("")
  }
  if (source === "laws") {
    const rows = await q(`select location_id as id, law_id, law_name, doc_type, depth, length(text) as chars from "Laws" where state = $1 and doc_type in ('SECTION', 'RULE', 'JOINT_RULE', 'PREAMBLE') and text is not null order by random() limit $2`, [state, sample])
    const out = []
    for (const r of rows) {
      const body = await sliced(`select substring(text from $4::int for 200000) as part from "Laws" where state = $1 and law_id = $2 and location_id = $3`, [state, r.law_id, r.id], r.chars)
      out.push({ kind: "text", body, url: `laws:${r.law_id}/${r.id}`, meta: { kind: "law", doc_type: r.doc_type, depth: r.depth, location_id: r.id, law_id: r.law_id, law_name: r.law_name } })
    }
    return out
  }
  // Bills first, then their texts: a random order over the texts table with
  // its join is minutes over the Data API; over Bills it is a second.
  // --since <year> keeps to recent sessions; the pipeline's number is every session's.
  const bills = await q(`select bill_id from "Bills" where state = $1 and session_id >= $2 order by random() limit $3`, [state, Number(arg("since", 0)), sample])
  if (!bills.length) return []
  const ids = bills.map((b) => Number(b.bill_id))
  const docs = await q(`select t.document_id as id, t.version, length(t.text) as chars from "BillTexts" t where t.bill_id = any($1::bigint[]) and t.text is not null`, [`{${ids.join(",")}}`])
  const printings = docs.filter((d) => !NOT_A_PRINTING.test(String(d.version ?? ""))).sort(() => Math.random() - 0.5).slice(0, sample)
  const out = []
  for (const d of printings) {
    const body = await sliced(`select substring(text from $2::int for 200000) as part from "BillTexts" where document_id = $1`, [d.id], d.chars)
    out.push({ kind: "text", body, url: `texts:${d.id}`, meta: { kind: "bill" } })
  }
  return out
}
const show = Number(arg("show", 0))
const heads = Number(arg("heads", 0))
let shownHeads = 0

const docs = await sources()
const dialects = {}
const unknown = {}
const fallouts = {}
const pattern = (note) => note.replace(/\d+/g, "N").replace(/:\s.*$/, "").slice(0, 60)
let clean = 0
let coverageSum = 0
let measured = 0
const failed = []
for (const s of docs) {
  if (s.failed || !s.body) {
    failed.push(`${s.url}: ${s.failed ?? "empty"}`)
    continue
  }
  const { doc, report } = fe.parse(s)
  // A captured error page falls out of the pipeline asking for a re-fetch and is never stored,
  // so it stays out of the mean here too; the count is printed.
  if (report.dialect === "error-page") {
    failed.push(`${s.url}: error page`)
    continue
  }
  measured++
  if (measured <= show) {
    const { outline } = await load("lib/xml/ir.ts")
    console.log(`--- ${s.url} (${report.dialect}, coverage ${report.coverage})`, report.notes.length ? report.notes : "")
    console.log(outline(doc).slice(0, 40).join("\n"))
  }
  dialects[report.dialect] = (dialects[report.dialect] ?? 0) + 1
  coverageSum += report.coverage
  if (report.coverage === 1 && report.dialect !== "unknown") clean++
  for (const [k, v] of Object.entries(report.unknown)) unknown[k] = (unknown[k] ?? 0) + v
  for (const n of report.notes) fallouts[pattern(n)] = (fallouts[pattern(n)] ?? 0) + 1
  if (report.notes.length && shownHeads < heads) {
    shownHeads++
    console.log(`--- ${s.url} ${JSON.stringify(report.notes.slice(0, 2))}\n    ${s.body.slice(0, 260).replace(/\s+/g, " ")}`)
  }
}
const topFallouts = Object.fromEntries(Object.entries(fallouts).sort((a, b) => b[1] - a[1]).slice(0, 12))
const top = Object.fromEntries(Object.entries(unknown).sort((a, b) => b[1] - a[1]).slice(0, 15))
const line = {
  jurisdiction: jurisdiction.toUpperCase(),
  name: fe.profile.name,
  source,
  sampled: measured,
  clean,
  coverage: measured ? Number((coverageSum / measured).toFixed(4)) : 0,
  dialects,
  unknown: top,
  fallouts: topFallouts,
  measuredAt: new Date().toISOString(),
}

let file = {}
try {
  file = JSON.parse(readFileSync(OUT, "utf8"))
} catch {}
// One line per jurisdiction and source, so statutes and bills sit side by side.
file[`${line.jurisdiction}/${source}`] = line
delete file[line.jurisdiction]
writeFileSync(OUT, JSON.stringify(file, null, 2) + "\n")

console.log(`${line.jurisdiction} (${line.name}) via ${source}: ${measured} sampled, ${clean} clean, coverage ${(line.coverage * 100).toFixed(1)}%`)
console.log("dialects:", dialects)
if (Object.keys(top).length) console.log("unknown elements:", top)
if (Object.keys(topFallouts).length) console.log("fall-outs:", topFallouts)
if (failed.length) console.log(`failed to read ${failed.length}:`, failed.slice(0, 5))
