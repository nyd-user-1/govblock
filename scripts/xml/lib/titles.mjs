// The title above each code in the library (2026-09-19; sql/033_library_titles.sql).
//
// The XML store addresses a jurisdiction's law by the unit its source
// publishes: an Alaska chapter, an Illinois act, a New York law. Most codes
// have a level above that unit — the title — and the sources carry it in
// three ways, or not at all:
//
//   in the unit's id         Alabama T10AC1 is Title 10A, chapter 1; Rhode Island
//                            C10-1 is Title 10; Alaska's chapter 01.05 is Title 1
//   after the heading's dash Alaska's chapter heading reads "Alaska Statutes —
//                            General Provisions": the title's name follows the dash
//   in neither               Hawaii, Iowa, Missouri, Nevada and Oregon; their own
//                            tables of titles are in ../sources/titles/<st>.json,
//                            each with the page it was read from
//
// A jurisdiction not named below has no level above its unit: its units are
// titles already (Arizona, the U.S. Code), whole codes (California, New York)
// or chapters with nothing above them (Kansas, North Carolina, Wisconsin).
// Those rows get no title, which is the right answer, not a gap.
//
// The same tables fill a unit named only by its number — Iowa's "Chapter 1",
// Maine's "Title 1" — where the source's own index names it.

import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "sources", "titles")

/** The official tables, by state code. */
export const TABLES = Object.fromEntries(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f.replace(/\.json$/, "").toUpperCase(), JSON.parse(readFileSync(join(DIR, f), "utf8"))])
)

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 }
const roman = (s) => {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]] ?? 0
    const next = ROMAN[s[i + 1]] ?? 0
    n += v < next ? -v : v
  }
  return n
}

/** A title key's reading order: Roman numerals by value, numbers by value, then the letter ("10A" after "10"). */
export function keyOrder(key) {
  const k = String(key)
  const m = /^([IVXLC]+)(?:-([A-Z]))?$/.exec(k)
  if (m) return roman(m[1]) * 100 + (m[2] ? m[2].charCodeAt(0) - 64 : 0)
  const n = /^(\d+)(?:\.(\d+))?([A-Z])?/i.exec(k)
  if (!n) return 1e9
  return Number(n[1]) * 100 + (n[2] ? Number(n[2]) : 0) + (n[3] ? n[3].toUpperCase().charCodeAt(0) - 64 : 0) / 100 + (/appendix/i.test(k) ? 50 : 0)
}

/** The part of a heading after its last dash: the title's name, where the source put it there. */
const suffixOf = (heading) => {
  const parts = String(heading ?? "").split(" — ")
  return parts.length > 1 ? parts[parts.length - 1].trim() : null
}

const bare = (s) => String(s ?? "").replace(/^0+(?=\d)/, "")

// Where each jurisdiction keeps its title. `key` reads it from the unit;
// `named` says where the name comes from: the heading after the dash, or the
// official table. `table` alone means the table assigns the unit to its title.
const RULES = {
  AK: { key: (r) => (/^(\d+)\./.exec(r.chapter ?? "") ?? [])[1], named: "heading" },
  // Alabama's ids misfile chapters, and worse, merge them: the load keyed a
  // chapter by its number within a subtitle, so T1C1 holds chapter 1 of Titles
  // 1, 11 and 22 at once — 46 of 1,445 laws, 50 chapters, on 2026-09-19. Its
  // sections' numbers say which titles a law holds (`section_titles`, most
  // sections first): the id's title where it is one of them, else the title
  // most of its sections are in. The merge itself is the loader's to undo.
  // Titles are named from the Agency's own list: a chapter heading's dash names
  // a subtitle where the title has them (Title 11's read "Municipal
  // Corporations Only").
  AL: {
    key: (r) => {
      const held = String(r.section_titles ?? "").split(",").map((x) => x.split(":")[0]).filter(Boolean)
      const own = (/^T(\d+[A-Z]?)C/i.exec(r.law_id) ?? [])[1]
      return own && held.includes(own) ? own : held[0] ?? own
    },
    named: "table",
    sections: true,
  },
  ID: { key: (r) => (/^T(\d+[A-Z]?)C/i.exec(r.law_id) ?? [])[1], named: "table" },
  MT: { key: (r) => (/^T(\d+)C/i.exec(r.law_id) ?? [])[1], named: "heading" },
  UT: { key: (r) => (/^T(\d+[A-Z]?)C/i.exec(r.law_id) ?? [])[1], named: "table" },
  // Vermont prints appendices to some titles (T03APPENDIXC003 is chapter 3 of Title 3's appendix), and lettered titles (T09AC001).
  VT: { key: (r) => { const m = /^T(\d+[A-Z]?)(APPENDIX)?C/i.exec(r.law_id); return m ? `${bare(m[1])}${m[2] ? " Appendix" : ""}` : null }, named: "heading" },
  ND: { key: (r) => (/^T(\d+(?:\.\d+)?)C/i.exec(r.law_id) ?? [])[1], named: "table" },
  NH: { key: (r) => (/^T([IVXLC]+(?:-[A-Z])?)C/.exec(r.law_id) ?? [])[1], named: "table" },
  RI: { key: (r) => (/^C(\d+[A-Z]?(?:\.\d+)?)-/i.exec(r.law_id) ?? [])[1], named: "heading" },
  SD: { key: (r) => (/^C(\d+[A-Z]?)-/i.exec(r.law_id) ?? [])[1], named: "heading" },
  // Illinois compiles its acts into chapters of the ILCS ("5 ILCS 280/"); the chapter is the level above the act.
  IL: { key: (r) => r.chapter || (/^(\d+) ILCS/.exec(r.law_name ?? "") ?? [])[1], named: "heading", label: "Chapter" },
  // Ohio's headings end "— Title 37 | Health-Safety-Morals". Chapters 1 to 9
  // are the Revised Code's General Provisions, which stand before Title 1 and
  // carry no number of their own.
  OH: {
    key: (r) => {
      const m = /^Title (\d+) \|/.exec(suffixOf(r.heading) ?? "")
      if (m) return m[1]
      const c = parseInt(r.chapter ?? "", 10)
      return Number.isFinite(c) ? String(c < 100 ? 0 : Math.floor(c / 100)) : null
    },
    name: (r) => (suffixOf(r.heading) ?? "").replace(/^Title \d+ \|\s*/, "") || null,
    named: "heading",
    unnumbered: { 0: "General Provisions" },
  },
  HI: { named: "table" },
  IA: { named: "table" },
  MO: { named: "table" },
  NV: { named: "table" },
  OR: { named: "table" },
  // A chapter Kentucky's list leaves out (repealed, reserved) still names its title after the dash.
  KY: { named: "table", byHeading: true },
  MA: { named: "table", label: "Part" },
}

/** The official table's title for a unit, by its chapter number or its id. */
function tableTitle(table, row) {
  if (!table?.titles?.length) return null
  const chapter = bare(row.chapter)
  for (const t of table.titles) {
    if (t.chapters?.some((c) => bare(c).toUpperCase() === chapter.toUpperCase())) return t
    if (t.lawIds?.includes(row.law_id)) return t
    if (t.range) {
      const n = parseInt(chapter, 10)
      if (Number.isFinite(n) && n >= t.range[0] && n <= t.range[1]) return t
    }
  }
  return null
}

const NUMBERED = /^\s*(chapter|title)\s+[\w.\-]+\s*$/i

/** Whether a jurisdiction's rule reads its sections' titles (`section_titles` on each row: "11:16,1:16,22:17"). */
export const needsSections = (state) => !!RULES[state]?.sections

/**
 * Every code of a jurisdiction, with its title and, where the source named it
 * only by number, its name. `rows` are { law_id, law_name, chapter, heading },
 * and `section_titles` where needsSections(state).
 * Returns a Map from law_id to { title, title_name, title_order, name }.
 */
export function titlesFor(state, rows) {
  const rule = RULES[state]
  const table = TABLES[state]
  const out = new Map()
  const label = rule?.label ?? table?.label ?? "Title"

  // The name a number-only unit is known by in the table: by its id, or by its chapter or title number.
  const nameFix = (r) => {
    if (!table?.chapterNames || (r.law_name && !NUMBERED.test(r.law_name))) return null
    return table.chapterNames[r.law_id] ?? table.chapterNames[bare(r.chapter)] ?? table.chapterNames[r.chapter] ?? null
  }

  if (!rule) {
    for (const r of rows) out.set(r.law_id, { title: null, title_name: null, title_order: null, name: nameFix(r) })
    return out
  }

  // First the key and the name each unit says for itself.
  const found = rows.map((r) => {
    let key = rule.key ? rule.key(r) : null
    let name = null
    let tableRow = null
    if (!key || rule.named === "table") {
      tableRow = tableTitle(table, r)
      if (!key && tableRow) key = tableRow.key
      if (!key && rule.byHeading) {
        const said = suffixOf(r.heading)?.toLowerCase()
        const match = said && table?.titles?.find((t) => t.name.toLowerCase() === said)
        if (match) key = match.key
      }
    }
    key = key ? bare(key) : null
    if (rule.named === "heading") name = rule.name ? rule.name(r) : suffixOf(r.heading)
    return { r, key, name, tableRow }
  })

  // Then one name per title: the table's where it has one, else the name most of the title's units carry.
  const names = new Map()
  const votes = new Map()
  for (const f of found) {
    if (!f.key) continue
    const official = table?.titles?.find((t) => bare(t.key) === f.key)
    if (official) names.set(f.key, official.name)
    if (f.name) {
      const tally = votes.get(f.key) ?? new Map()
      tally.set(f.name, (tally.get(f.name) ?? 0) + 1)
      votes.set(f.key, tally)
    }
  }
  for (const [key, tally] of votes) if (!names.has(key)) names.set(key, [...tally].sort((a, b) => b[1] - a[1])[0][0])

  // The titles' reading order: the table's order where it has the title, else the key's own.
  const officialIndex = new Map((table?.titles ?? []).map((t, i) => [bare(t.key), i]))
  const keys = [...new Set(found.map((f) => f.key).filter(Boolean))].sort((a, b) => {
    const ia = officialIndex.get(a)
    const ib = officialIndex.get(b)
    if (ia !== undefined && ib !== undefined) return ia - ib
    return keyOrder(a) - keyOrder(b)
  })
  const order = new Map(keys.map((k, i) => [k, i + 1]))

  for (const f of found) {
    const unnumbered = f.key ? rule.unnumbered?.[f.key] : undefined
    out.set(f.r.law_id, {
      title: unnumbered ?? (f.key ? `${label} ${f.key}` : null),
      title_name: unnumbered ? null : f.key ? names.get(f.key) ?? null : null,
      title_order: f.key ? order.get(f.key) : null,
      name: nameFix(f.r),
    })
  }
  return out
}
