import { jurisdictionOf, segment } from "@/lib/xml/address"

// Where scripts/xml/sources/statutes.mjs stores a "Laws" section, in the
// app (2026-09-15): the law search and the code outline both turn "Laws" rows
// into Work addresses, and must land where the pipeline put them.

export const LEAF = ["SECTION", "RULE", "JOINT_RULE", "PREAMBLE"]

// USLM's level prefixes, as the pipeline addresses a section.
const PREFIX: Record<string, string> = { TITLE: "t", SUBTITLE: "st", CHAPTER: "ch", SUBCHAPTER: "sch", PART: "pt", SUBPART: "spt", DIVISION: "d", SUBDIVISION: "sd", ARTICLE: "art", SUBARTICLE: "sart", SECTION: "s", RULE: "r" }
export const prefixOf = (docType: string) => PREFIX[docType.toUpperCase()] ?? segment(docType.toLowerCase()).toLowerCase()

export const isConstitution = (lawId: string, lawName: string | null) => /^CNS$|CONST/i.test(lawId) || /constitution/i.test(lawName ?? "")

/** A code's segment in the address back to the law ids "Laws" may file it under: "t7" → USC07, "agm" → AGM. */
export const lawIdsOf = (jurisdiction: string, unit: string) => {
  const title = /^t(\d+)([a-z]?)$/.exec(unit)
  return jurisdiction === "us" && title ? [`USC${title[1].padStart(2, "0")}${title[2].toUpperCase()}`] : [unit, unit.toUpperCase()]
}

/** A section's number as the address writes it. */
export const sectionNumber = (docLevelId: string | null, locationId: string) => segment(String(docLevelId ?? "").replace(/^§+\s*/, "").replace(/\.$/, "").trim() || locationId)

export type LawRow = { state: string; law_id: string; law_name: string | null; doc_type: string; doc_level_id: string | null; location_id: string; parent_type: string | null; parent_level: string | null }

/**
 * A section's Work address. `restarts` says whether its number repeats in its
 * law, which puts it under its container; null when not known, and then both
 * forms are returned, the plain one first.
 */
export function lawWorks(r: LawRow, restarts: boolean | null = null): string[] {
  const juris = jurisdictionOf(r.state)
  const num = sectionNumber(r.doc_level_id, r.location_id)
  const leaf = `${prefixOf(r.doc_type)}${num}`
  if (juris === "us") {
    const title = /^USC0*(\d+)([A-Za-z]?)$/i.exec(r.law_id)
    return title ? [`/us/usc/t${title[1]}${title[2].toLowerCase()}/s${num}`] : []
  }
  const constitution = isConstitution(r.law_id, r.law_name)
  const base = constitution ? `/${juris}/const` : `/${juris}/code/${segment(r.law_id.toLowerCase())}`
  const container = r.parent_type && r.parent_level ? `${base}/${prefixOf(r.parent_type)}${segment(r.parent_level)}/${leaf}` : null
  if (constitution || restarts === true) return [container ?? `${base}/${leaf}`]
  if (restarts === false) return [`${base}/${leaf}`]
  return [`${base}/${leaf}`, ...(container ? [container] : [])]
}
