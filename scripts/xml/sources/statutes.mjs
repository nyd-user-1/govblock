// A state's statutes from "Laws", a law at a time (or every law, for a state
// whose "Laws" holds hundreds of separate acts). "Laws" is one row per
// location, upserted, with the tree in parent_location_id; the leaves carry
// the words of the law, and each leaf is one Work. Its Expression is dated
// by active_date where the source gave one, else by the day it was read.
import { q } from "../../laws/lib/db.mjs"
import { codeSegment, jurisdictionOf, segment } from "../lib/address.mjs"

const LEAF = new Set(["SECTION", "RULE", "JOINT_RULE", "PREAMBLE"])
// USLM's level prefixes (schema.md, "Statute sections, and portions").
const PREFIX = { TITLE: "t", SUBTITLE: "st", CHAPTER: "ch", SUBCHAPTER: "sch", PART: "pt", SUBPART: "spt", DIVISION: "d", SUBDIVISION: "sd", ARTICLE: "art", SUBARTICLE: "sart", SECTION: "s", RULE: "r" }
const prefixOf = (docType) => PREFIX[String(docType).toUpperCase()] ?? segment(String(docType).toLowerCase()).toLowerCase()

/** Rows of one law in document order, a page at a time, the page shrinking when a long section would pass the Data API's megabyte. */
async function* rowsOf(state, lawId) {
  let after = -1
  let size = 200
  for (;;) {
    let rows
    try {
      rows = await q(
        `select location_id, doc_type, doc_level_id, title, parent_location_id, sequence_no, law_name, law_type,
                active_date::text as active_date, fetched_at::date::text as fetched_date, repealed, text
           from "Laws" where state = $1 and law_id = $2 and sequence_no > $3 order by sequence_no limit $4`,
        [state, lawId, after, size]
      )
    } catch (error) {
      if (/response size|exceeded|too large/i.test(String(error?.message)) && size > 1) {
        size = Math.max(1, Math.floor(size / 4))
        continue
      }
      throw error
    }
    for (const r of rows) yield r
    if (rows.length < size) return
    after = rows[rows.length - 1].sequence_no
    size = Math.min(200, size * 2)
  }
}

const isConstitution = (lawId, lawName) => /^CNS$|CONST/i.test(lawId) || /constitution/i.test(lawName ?? "")

/**
 * The job's documents. `unit` is a law id, or "*" for every law the state holds.
 * New York's rows go through its own front end with the row as meta; every
 * other state's through its front end if it has one, else plain text.
 */
export async function* statutes({ jurisdiction, unit, log }) {
  const state = jurisdiction === "us" ? "US" : jurisdiction.replace(/^us-/, "").toUpperCase()
  const laws = unit === "*" ? (await q(`select distinct law_id from "Laws" where state = $1 order by 1`, [state])).map((r) => r.law_id) : [unit]
  const juris = jurisdictionOf(state)

  for (const lawId of laws) {
    const rows = []
    for await (const r of rowsOf(state, lawId)) rows.push(r)
    if (!rows.length) {
      yield { fallout: { stage: "source", reason: "no rows in Laws", detail: `${state} ${lawId}`, sourceRef: `Laws:${state}/${lawId}` } }
      continue
    }
    const byId = new Map(rows.map((r) => [r.location_id, r]))
    const lawName = rows[0].law_name
    const constitution = isConstitution(lawId, lawName)
    const leaves = rows.filter((r) => LEAF.has(String(r.doc_type).toUpperCase()) && r.text)
    yield { count: leaves.length }

    // A number that repeats inside the law restarts in a container (a
    // constitution's articles, a chapter-numbered code): those sections are
    // addressed under their parent level.
    const numberOf = (r) => String(r.doc_level_id ?? "").replace(/^§+\s*/, "").replace(/\.$/, "").trim() || r.location_id
    const counts = new Map()
    for (const r of leaves) counts.set(numberOf(r), (counts.get(numberOf(r)) ?? 0) + 1)
    const base = constitution ? `/${juris}/const` : `/${juris}/code/${codeSegment(state, lawId)}`
    const taken = new Set()

    const path = (r) => {
      const out = []
      for (let p = byId.get(r.parent_location_id); p; p = byId.get(p.parent_location_id)) out.unshift(p.title ? `${p.doc_level_id ?? ""} ${p.title}`.trim() : String(p.doc_level_id ?? ""))
      return [lawName, ...out].filter((s, i, all) => s && s !== all[i - 1]).join(" › ")
    }

    for (const r of leaves) {
      const num = numberOf(r)
      let container = ""
      if (constitution || counts.get(num) > 1) {
        const parent = byId.get(r.parent_location_id)
        if (parent && parent.doc_level_id) container = `/${prefixOf(parent.doc_type)}${segment(parent.doc_level_id)}`
      }
      const work = `${base}${container}/${prefixOf(r.doc_type)}${segment(num)}`
      if (taken.has(work)) {
        yield { fallout: { work, stage: "source", reason: "section number repeats in its container", detail: `${state} ${lawId} ${r.location_id}`, sourceRef: `Laws:${state}/${lawId}/${r.location_id}` } }
        continue
      }
      taken.add(work)
      yield {
        work,
        unit: "",
        session: null,
        label: container ? `${lawName}, ${container.slice(1)} § ${num}` : `${lawName} § ${num}`,
        sourceUrl: null,
        sourceRef: `Laws:${state}/${lawId}/${r.location_id}`,
        frontEnd: state,
        source: { kind: "text", body: r.text, meta: { kind: "law", doc_type: r.doc_type, location_id: r.location_id, law_id: lawId, law_name: lawName } },
        info: {
          kind: "statute",
          root: "lawDoc",
          number: `§ ${num}`,
          title: r.title ?? null,
          publisher: null,
          fidelity: "plain-text",
          date: r.active_date ?? r.fetched_date,
          dateBasis: r.active_date ? "active" : "fetched",
          path: path(r),
          // A state's own front end returns the section element; plain text returns a body set inside one (lib/emit.mjs).
          section: { num: `§ ${num}`, heading: r.title ?? null },
          repealed: !!r.repealed,
        },
      }
    }
    log(`${lawId}: ${leaves.length.toLocaleString()} sections of ${rows.length.toLocaleString()} rows`)
  }
}
