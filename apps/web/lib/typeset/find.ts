import "server-only"

import { q } from "@/lib/policy/db"
import { recognize } from "@/lib/typeset/cite"
import { findExpression, stateOfJurisdiction } from "@/lib/typeset/expression-document"
import { jurisdictionOf, parseAddress, segment } from "@/lib/xml/address"
import { jurisdictionName, workHref } from "@/lib/xml/library"
import { codeName, loadCatalogue, type CatalogueRow } from "@/lib/xml/library-data"

// Search across the XML store (Brendan's road test, 2026-09-14, item 3): the
// smallest search that answers "find § 16 of the Agriculture and Markets law",
// "7 USC 1" and "any section about milk pricing", for the Library page and the
// reader's search box. Three readings of what was typed, each ending on a Work
// the `expressions` index holds:
//
//   an address or a citation   "/us/usc/t7/s1", "7 USC 1", "section 16 of the agriculture and markets law"
//   a code named, a number     "agriculture and markets 16", "california food and agricultural 1"
//   words in a heading         "milk pricing": "Laws".title on its trigram index
//
// Headings and addresses only. The text of five million Expressions is not
// searched: "Laws".tsv would reach it, but a common word ("health") matches a
// few hundred thousand sections and the weighted query took 45 s.

export type FindItem = {
  /** How the words reached it. */
  via: "citation" | "code" | "heading"
  label: string
  heading: string | null
  address: string
  href: string
  jurisdiction: string
  date: string | null
  coverage: number | null
}

export type FindResponse = { q: string; items: FindItem[] }

export type FindScope = {
  /** The reader's jurisdiction ("us-ny"): its sections sort first. */
  jurisdiction?: string | null
  /** A library the search stays inside: "/us-ny", "/us-ny/code/agm", "/us/usc/t7". */
  within?: string | null
}

const LIMIT = 40
const LEAF = ["SECTION", "RULE", "JOINT_RULE", "PREAMBLE"]
// USLM's level prefixes, as scripts/xml/sources/statutes.mjs addresses a section.
const PREFIX: Record<string, string> = { TITLE: "t", SUBTITLE: "st", CHAPTER: "ch", SUBCHAPTER: "sch", PART: "pt", SUBPART: "spt", DIVISION: "d", SUBDIVISION: "sd", ARTICLE: "art", SUBARTICLE: "sart", SECTION: "s", RULE: "r" }
const prefixOf = (docType: string) => PREFIX[docType.toUpperCase()] ?? segment(docType.toLowerCase()).toLowerCase()
const isConstitution = (lawId: string, lawName: string | null) => /^CNS$|CONST/i.test(lawId) || /constitution/i.test(lawName ?? "")
const textArray = (xs: string[]) => `{${[...new Set(xs)].map((x) => `"${x.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`
const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** A code's segment in the address back to the law ids "Laws" may file it under: "t7" → USC07, "agm" → AGM. */
const lawIdsOf = (jurisdiction: string, unit: string) => {
  const title = /^t(\d+)([a-z]?)$/.exec(unit)
  return jurisdiction === "us" && title ? [`USC${title[1].padStart(2, "0")}${title[2].toUpperCase()}`] : [unit, unit.toUpperCase()]
}

type Stored = { work: string; label: string | null; date: string | null; coverage: number | null }

/** The latest stored Expression of each Work that exists, in one read of the address index. */
async function stored(works: string[]): Promise<Map<string, Stored>> {
  if (!works.length) return new Map()
  const rows = await q<Stored>(
    `select distinct on (work) work, label, expression_date::text as date, coverage from expressions where work = any($1::text[]) order by work, expression_date desc`,
    [textArray(works)]
  )
  return new Map(rows.map((r) => [r.work, { ...r, coverage: r.coverage === null ? null : Number(r.coverage) }]))
}

/** A section number as the store may hold its letter: as typed, and upper and lower case ("76-a", "76-A"). */
const numberForms = (n: string) => [...new Set([n, n.toUpperCase(), n.toLowerCase()])]

// ------------------------------------------------------------- citations ---

async function citations(text: string, scope: FindScope): Promise<FindItem[]> {
  if (text.startsWith("/")) {
    const found = parseAddress(text) ? await findExpression(text).catch(() => null) : null
    if (!found) return []
    return [{ via: "citation", label: found.row.label ?? found.row.work, heading: null, address: found.row.work, href: workHref(text), jurisdiction: found.row.jurisdiction, date: found.row.expression_date, coverage: found.row.coverage }]
  }
  // "7 usc 1", "pl 119 21", and New York's "§ 16 of the … law" as its recognizer reads them.
  const words = text
    .replace(/\bu\.?\s?s\.?\s?c\.?(?=\s|$)/gi, "U.S.C.")
    .replace(/\bpl\s+(\d+)[\s-]+(\d+)/gi, "Public Law $1-$2")
    .replace(/(^|\s)§+\s*(?=\d)/g, "$1section ")
  const jurisdictions = [...new Set([scope.jurisdiction ?? "us", "us-ny"])]
  const cites = jurisdictions.flatMap((jurisdiction) => recognize(words, { jurisdiction })).filter((c) => c.work)
  const found = await stored(cites.map((c) => c.work!))
  const seen = new Set<string>()
  return cites.flatMap((c) => {
    const row = found.get(c.work!)
    if (!row || seen.has(row.work)) return []
    seen.add(row.work)
    const address = c.address ?? c.work!
    return [{ via: "citation" as const, label: row.label ?? row.work, heading: null, address: row.work, href: workHref(address), jurisdiction: row.work.split("/")[1], date: row.date, coverage: row.coverage }]
  })
}

// ------------------------------------------------------- a code, a number ---

const FILLER = new Set(["section", "sections", "sec", "of", "the", "law", "laws", "code", "codes", "and", "statute", "statutes", "consolidated", "annotated", "revised"])
/** Words a question wraps around what it asks for: "find any section about milk pricing". */
const ASKING = new Set(["find", "show", "any", "all", "about", "on", "for", "with", "that", "which", "what", "where", "concerning", "regarding", "relating", "related", "to", "in", "a", "an"])

async function codeAndNumber(text: string, scope: FindScope): Promise<FindItem[]> {
  const tokens = text.toLowerCase().replace(/§+/g, " ").split(/[\s,]+/).filter(Boolean)
  const numbers = tokens.filter((t) => /^\d+[a-z]?(?:[-.:][0-9a-z]+)*$/.test(t))
  const words = tokens.filter((t) => /^[a-z&'.]+$/.test(t) && !FILLER.has(t.replace(/\.$/, "")) && !ASKING.has(t) && t !== "&" && t.length > 1)
  if (numbers.length !== 1 || !words.length) return []
  const number = numbers[0]
  const rows = await loadCatalogue()
  const named = (r: CatalogueRow) => `${codeName(r)} ${jurisdictionName(r.jurisdiction)}`.toLowerCase()
  const codes = rows
    .filter((r) => (r.kind === "code" || r.kind === "usc") && (!scope.within || r.prefix.startsWith(scope.within)) && words.every((w) => named(r).includes(w)))
    .sort((a, b) => Number(b.jurisdiction === scope.jurisdiction) - Number(a.jurisdiction === scope.jurisdiction) || codeName(a).length - codeName(b).length || b.works - a.works)
    .slice(0, 6)
  const candidates = codes.flatMap((r) => numberForms(number).map((n) => ({ row: r, work: `${r.prefix}/s${n}` })))
  const found = await stored(candidates.map((c) => c.work))
  const seen = new Set<string>()
  const hits = candidates.filter((c) => found.has(c.work) && !seen.has(c.work) && seen.add(c.work))
  return hits.map((h) => {
    const row = found.get(h.work)!
    return { via: "code" as const, label: row.label ?? `${codeName(h.row)} § ${number}`, heading: null, address: h.work, href: workHref(h.work), jurisdiction: h.row.jurisdiction, date: row.date, coverage: row.coverage }
  })
}

/** The heading "Laws" files for a section named by its address: "/us-ny/code/agm/s16", "/us/usc/t7/s1". */
async function headingOf(work: string): Promise<string | null> {
  const [, jurisdiction, kind, unit, section, deeper] = work.split("/")
  if (deeper || !unit || !section?.startsWith("s") || (kind !== "code" && kind !== "usc")) return null
  const rows = await q<{ title: string | null }>(
    `select title from "Laws" where state = $1 and law_id = any($2::text[]) and doc_level_id = any($3::text[]) and doc_type = any($4::text[]) limit 1`,
    [stateOfJurisdiction(jurisdiction), textArray(lawIdsOf(jurisdiction, unit)), textArray(numberForms(section.slice(1))), textArray(LEAF)]
  )
  return rows[0]?.title ?? null
}

// -------------------------------------------------------------- headings ---

type LawRow = { state: string; law_id: string; law_name: string | null; doc_type: string; doc_level_id: string | null; location_id: string; title: string; parent_type: string | null; parent_level: string | null }

/** "pricing" → "pric", so a heading that says "prices" is found; short words stay whole. */
const stem = (word: string) => (word.length > 5 ? word.replace(/(?:ings|ing|ies|es|ed|s)$/, "") : word)

/** Where scripts/xml/sources/statutes.mjs stored a "Laws" section: its plain address, and the one under its container for a number that restarts. */
function worksOfLaw(r: LawRow): string[] {
  const juris = jurisdictionOf(r.state)
  const num = segment(String(r.doc_level_id ?? "").replace(/^§+\s*/, "").replace(/\.$/, "").trim() || r.location_id)
  const leaf = `${prefixOf(r.doc_type)}${num}`
  if (juris === "us") {
    const title = /^USC0*(\d+)([A-Za-z]?)$/i.exec(r.law_id)
    return title ? [`/us/usc/t${title[1]}${title[2].toLowerCase()}/s${num}`] : []
  }
  const constitution = isConstitution(r.law_id, r.law_name)
  const base = constitution ? `/${juris}/const` : `/${juris}/code/${segment(r.law_id.toLowerCase())}`
  const container = r.parent_type && r.parent_level ? `${base}/${prefixOf(r.parent_type)}${segment(r.parent_level)}/${leaf}` : null
  return constitution ? (container ? [container] : []) : [`${base}/${leaf}`, ...(container ? [container] : [])]
}

async function headings(text: string, scope: FindScope): Promise<FindItem[]> {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !FILLER.has(w) && !ASKING.has(w))
    .slice(0, 5)
    .map(stem)
  if (!words.length) return []
  const params: unknown[] = words.map(like)
  const where = words.map((_, i) => `l.title ilike $${i + 1}`)
  const [, jurisdiction, kind, unit] = (scope.within ?? "").split("/")
  if (jurisdiction) {
    params.push(stateOfJurisdiction(jurisdiction))
    where.push(`l.state = $${params.length}`)
    if (unit && (kind === "code" || kind === "usc")) {
      params.push(textArray(lawIdsOf(jurisdiction, unit)))
      where.push(`l.law_id = any($${params.length}::text[])`)
    }
  }
  params.push(textArray(LEAF), stateOfJurisdiction(scope.jurisdiction ?? "us"))
  const rows = await q<LawRow>(
    `select l.state, l.law_id, l.law_name, l.doc_type, l.doc_level_id, l.location_id, l.title, p.doc_type as parent_type, p.doc_level_id as parent_level
       from "Laws" l
       left join "Laws" p on p.state = l.state and p.law_id = l.law_id and p.location_id = l.parent_location_id
      where ${where.join(" and ")} and l.doc_type = any($${params.length - 1}::text[]) and l.text is not null
      order by (l.state = $${params.length}) desc, length(l.title), l.state, l.law_id, l.sequence_no
      limit ${LIMIT * 2}`,
    params
  )
  const candidates = rows.map((r) => ({ row: r, works: worksOfLaw(r) }))
  const found = await stored(candidates.flatMap((c) => c.works))
  const seen = new Set<string>()
  const out: FindItem[] = []
  for (const c of candidates) {
    const work = c.works.find((w) => found.has(w))
    if (!work || seen.has(work)) continue
    seen.add(work)
    const row = found.get(work)!
    out.push({ via: "heading", label: row.label ?? work, heading: c.row.title, address: work, href: workHref(work), jurisdiction: work.split("/")[1], date: row.date, coverage: row.coverage })
    if (out.length >= LIMIT) break
  }
  return out
}

/** Every reading of what was typed, citations first, each Work once. */
export async function findLaw(text: string, scope: FindScope = {}): Promise<FindItem[]> {
  const typed = text.trim().slice(0, 120)
  if (typed.length < 2) return []
  const named = [...(await citations(typed, scope)), ...(await codeAndNumber(typed, scope))].filter((item, at, all) => all.findIndex((other) => other.address === item.address) === at)
  // A citation that landed is the answer; the words are read as a heading only when nothing was named.
  if (named.length || typed.startsWith("/")) return Promise.all(named.slice(0, 6).map(async (item) => ({ ...item, heading: await headingOf(item.address) })))
  return headings(typed, scope)
}
