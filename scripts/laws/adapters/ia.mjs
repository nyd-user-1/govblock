// Iowa — the Code of Iowa, from the Legislative Services Agency.
//
// `legis.iowa.gov/docs/code/1.pdf` is a whole chapter, typeset by the Agency
// and carrying its text. The chapter prints its own contents first — one line
// per section, number and catchline — and then the law, in the same shape, so
// every section number appears twice. The second is the one with the words
// behind it, and that is the rule used here: where a number appears more than
// once, the longest of them is the section.
//
// Iowa numbers its chapters 1 to about 915 and hangs lettered chapters off
// many of them (8A, 15E, 261B), and the Agency publishes no machine-readable
// list, so the numbers are enumerated and the gaps answer 404.
//
// A law here is a chapter, which is what Iowa cites: "Iowa Code § 1.1" is
// section 1 of chapter 1.
import { fetchPdf, prose } from "../lib/pdf.mjs"
import { map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { titleCase } from "../lib/text.mjs"

const FILE = (c) => `https://www.legis.iowa.gov/docs/code/${c}.pdf`

const LETTERS = ["", "A", "B", "C", "D", "E"]
const CHAPTERS = []
for (let n = 1; n <= 915; n++) for (const letter of LETTERS) CHAPTERS.push(`${n}${letter}`)

export default {
  id: "ia-lsa",
  name: "Iowa Legislative Services Agency — the Code of Iowa",
  states: ["IA"],
  source: "https://www.legis.iowa.gov/law/iowaCode",

  async *laws({ state, only, have, log }) {
    const wanted = CHAPTERS.filter((c) => (!only || `C${c}` === only.toUpperCase()) && !have?.has(`C${c}`))
    let at = 0
    const documents = await map(wanted, 10, async (c) => {
      const pdf = await fetchPdf(state, FILE(c), { notFound: null }).catch(() => null)
      at += 1
      if (at % 500 === 0) log(`${at}/${wanted.length} chapter numbers tried`)
      return pdf
    })

    for (let i = 0; i < wanted.length; i++) {
      const raw = documents[i]
      if (!raw) continue
      const law = read(raw, wanted[i])
      if (!law) continue
      log(`C${wanted[i]} · ${law.nodes.length - 1} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(raw, chapter) {
  const words = prose(raw).replace(/\s+/g, " ").trim()
  const escaped = chapter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Every place a section of this chapter opens, in the order they are printed.
  const opens = new RegExp(`(?=\\b${escaped}\\.[0-9A-Za-z]+\\s+[A-Z])`, "g")
  const parts = words.split(opens).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const name = titleCase(
    (new RegExp(`CHAPTER\\s+${escaped}\\s+([A-Z][A-Z ,'&\\u2014-]*?)\\s+${escaped}\\.`).exec(parts[0])?.[1] ?? "").trim()
  )

  // The contents and the law use the same shape, so a number that appears more
  // than once is kept at its longest, which is the one carrying the law.
  const best = new Map()
  for (const part of parts) {
    const m = new RegExp(`^(${escaped}\\.[0-9A-Za-z]+)\\s+(.*)$`, "s").exec(part)
    if (!m) continue
    const previous = best.get(m[1])
    if (!previous || part.length > previous.part.length) best.set(m[1], { part, rest: m[2] })
  }
  if (!best.size) return null

  const nodes = [
    { location_id: "CHAPTER", doc_type: "CHAPTER", doc_level_id: chapter, title: name || null, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["CHAPTER"])
  for (const [number, { part, rest }] of best) {
    const location_id = unique(number, seen)
    seen.add(location_id)
    const cut = /^(.{2,160}?\.)\s+(?=\S)/.exec(rest)
    nodes.push({
      location_id,
      doc_type: "SECTION",
      doc_level_id: number,
      title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
      parent_location_id: "CHAPTER",
      depth: 1,
      repealed: /\brepealed\b/i.test(rest.slice(0, 120)),
      text: part,
    })
  }
  return {
    law_id: `C${chapter}`,
    law_name: name || `Chapter ${chapter}`,
    law_type: "CONSOLIDATED",
    chapter,
    nodes: inOrder(nodes),
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
