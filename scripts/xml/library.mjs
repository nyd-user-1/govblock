// The library's catalogue (window 4, 2026-09-14): what the store holds, by
// code and by session, with the names a reader knows them by, written to
// `xml_library` (sql/012_library.sql). The Library page's top level and the
// `/` command read it; the Works inside a code or a session are read live
// from `expressions`. Run after a load; the nightly XML step can run it last.
//
//   node scripts/xml/library.mjs            every jurisdiction in the store
//   node scripts/xml/library.mjs us-ny us   some
//
// Each code carries the title above it (title, title_name, title_order;
// sql/033_library_titles.sql), derived by lib/titles.mjs from the unit's id,
// its heading, or the jurisdiction's own table of titles, and a code the source
// named only by its number ("Chapter 1") takes its name from that table too.
//
// One read per jurisdiction and kind, grouped on the index's leading columns,
// so no statement scans the whole index. Each jurisdiction's rows are
// replaced in one transaction, so a reader never sees half a catalogue.
import { begin, commit, exec, q, rollback } from "../laws/lib/db.mjs"
import { codeSegment } from "./lib/address.mjs"
import { needsSections, titlesFor } from "./lib/titles.mjs"

const round = (x) => (x === null || x === undefined ? null : Math.round(Number(x) * 1000) / 1000)
const stateOf = (j) => (j === "us" ? "US" : j.replace(/^us-/, "").toUpperCase())
const COLUMNS = ["prefix", "jurisdiction", "kind", "unit", "name", "works", "expressions", "coverage", "first_date", "latest_date", "title", "title_name", "title_order"]
const CHUNK = 80

const asked = process.argv.slice(2)
const jurisdictions = asked.length ? asked : (await q(`select distinct jurisdiction from xml_jobs where status = 'done' order by 1`)).map((r) => r.jurisdiction)

async function write(jurisdiction, rows) {
  const tx = await begin()
  try {
    await exec(`delete from xml_library where jurisdiction = $1`, [jurisdiction], tx)
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const params = []
      const values = chunk.map((row) => {
        const slots = COLUMNS.map((c) => {
          params.push(row[c] ?? null)
          const at = `$${params.length}`
          return c === "first_date" || c === "latest_date" ? `${at}::date` : c === "coverage" ? `${at}::real` : c === "title_order" ? `${at}::int` : at
        })
        return `(${slots.join(", ")})`
      })
      await exec(`insert into xml_library (${COLUMNS.join(", ")}) values ${values.join(", ")}`, params, tx)
    }
    await commit(tx)
  } catch (error) {
    await rollback(tx)
    throw error
  }
}

const started = Date.now()
let total = 0
for (const jurisdiction of jurisdictions) {
  const t = Date.now()
  const state = stateOf(jurisdiction)
  const codes = needsSections(state)
    ? await q(
        `with s as (
           select law_id, split_part(doc_level_id, '-', 1) as t, count(*) as n
             from "Laws" where state = $1 and doc_type = 'SECTION' group by 1, 2
         ), held as (
           select law_id, string_agg(t || ':' || n, ',' order by n desc, t) as section_titles from s group by 1
         )
         select l.law_id, max(l.law_name) as law_name, max(l.chapter) as chapter, max(l.title) as heading, max(h.section_titles) as section_titles
           from "Laws" l left join held h on h.law_id = l.law_id
          where l.state = $1 and l.depth = 0 group by l.law_id`,
        [state]
      )
    : await q(`select law_id, max(law_name) as law_name, max(chapter) as chapter, max(title) as heading from "Laws" where state = $1 and depth = 0 group by law_id`, [state])
  const titled = titlesFor(state, codes)
  const names = new Map(codes.map((r) => [codeSegment(state, r.law_id), r.law_name]))
  const titles = new Map(codes.map((r) => [codeSegment(state, r.law_id), titled.get(r.law_id)]))
  const statutes = await q(
    `select split_part(work, '/', 3) as kind, split_part(work, '/', 4) as code, count(*)::int as expressions, count(distinct work)::int as works,
            avg(coverage)::real as coverage, min(expression_date)::text as first, max(expression_date)::text as latest, min(label) as sample
       from expressions where jurisdiction = $1 and kind = 'statute' group by 1, 2 order by 1, 2`,
    [jurisdiction]
  )
  const sessions = await q(
    `select session, count(*)::int as expressions, count(distinct work)::int as works, avg(coverage)::real as coverage,
            min(expression_date)::text as first, max(expression_date)::text as latest
       from expressions where jurisdiction = $1 and kind = 'bill' group by 1 order by 1 desc`,
    [jurisdiction]
  )

  const rows = []
  // A constitution's sections are addressed under their articles; its library is the constitution.
  let constitution = null
  for (const s of statutes) {
    if (s.kind === "const") {
      constitution ??= { prefix: `/${jurisdiction}/const`, jurisdiction, kind: "const", unit: "", name: "Constitution", works: 0, expressions: 0, weighted: 0, first_date: s.first, latest_date: s.latest }
      constitution.weighted += Number(s.coverage ?? 0) * s.expressions
      constitution.works += s.works
      constitution.expressions += s.expressions
      if (s.first < constitution.first_date) constitution.first_date = s.first
      if (s.latest > constitution.latest_date) constitution.latest_date = s.latest
      continue
    }
    // A stored label is "<law name> § <number>"; "Laws" names the code where it can.
    const fromLabel = String(s.sample ?? "").split(" § ")[0].trim()
    const t = titles.get(s.code)
    rows.push({
      prefix: `/${jurisdiction}/${s.kind}/${s.code}`, jurisdiction, kind: s.kind, unit: s.code,
      name: t?.name ?? names.get(s.code) ?? (fromLabel || null),
      works: s.works, expressions: s.expressions, coverage: round(s.coverage), first_date: s.first, latest_date: s.latest,
      title: t?.title ?? null, title_name: t?.title_name ?? null, title_order: t?.title_order ?? null,
    })
  }
  if (constitution) {
    const { weighted, ...row } = constitution
    rows.push({ ...row, coverage: round(weighted / row.expressions) })
  }
  for (const s of sessions) {
    rows.push({ prefix: `/${jurisdiction}/bill/${s.session}`, jurisdiction, kind: "bill", unit: s.session, name: null, works: s.works, expressions: s.expressions, coverage: round(s.coverage), first_date: s.first, latest_date: s.latest })
  }

  await write(jurisdiction, rows)
  total += rows.length
  const withTitle = rows.filter((r) => r.title).length
  console.log(`${jurisdiction}: ${rows.length - sessions.length} codes (${withTitle} under a title), ${sessions.length} sessions (${Date.now() - t} ms)`)
}
console.log(`${total} rows in xml_library, ${((Date.now() - started) / 1000).toFixed(1)} s`)
