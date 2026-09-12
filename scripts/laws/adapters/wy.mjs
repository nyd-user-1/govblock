// Wyoming — the Wyoming Statutes, from the Legislative Service Office.
//
// `wyoleg.gov/statutes/compress/title01.pdf` is a whole title in one file —
// Title 1 is 700 KB of it — typeset by the Office and carrying its text. The
// file runs its chapters and sections together, and marks each with its own
// number: "CHAPTER 1 - GENERAL PROVISIONS…" then "1-1-101. Provisions to be
// liberally construed. The Code of Civil Procedure…".
//
// A law here is a title, which is how Wyoming arranges and cites: "Wyo. Stat.
// § 1-1-101" is title 1, chapter 1, section 101.
import { fetchPdf, prose } from "../lib/pdf.mjs"
import { map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { titleCase } from "../lib/text.mjs"

const FILE = (t) => `https://www.wyoleg.gov/statutes/compress/title${t}.pdf`
const TITLES = Array.from({ length: 45 }, (_, i) => String(i + 1).padStart(2, "0"))

// Where a chapter heading or a section begins. Both are the only marks the
// print gives, and both start at a number.
const MARKS = /(?=\bCHAPTER\s+\d+[A-Z]?\s+-\s|\b\d{1,2}-\d{1,2}-\d{3}(?:\.\d+)?\.\s)/g

export default {
  id: "wy-lso",
  name: "Wyoming Legislative Service Office — the Wyoming Statutes",
  states: ["WY"],
  source: "https://www.wyoleg.gov/StateStatutes/StatutesDownload",

  async *laws({ state, only, have, log }) {
    const wanted = TITLES.filter((t) => (!only || `T${Number(t)}` === only.toUpperCase()) && !have?.has(`T${Number(t)}`))
    let at = 0
    const documents = await map(wanted, 6, async (t) => {
      const pdf = await fetchPdf(state, FILE(t), { notFound: null }).catch(() => null)
      at += 1
      if (at % 10 === 0) log(`${at}/${wanted.length} titles tried`)
      return pdf
    })

    for (let i = 0; i < wanted.length; i++) {
      const raw = documents[i]
      if (!raw) continue
      const law = read(raw, wanted[i])
      if (!law) {
        log(`· title ${Number(wanted[i])} — the file carries no section`)
        continue
      }
      log(`T${Number(wanted[i])} · ${law.nodes.filter((n) => n.doc_type === "SECTION").length} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(raw, t) {
  const number = String(Number(t))
  const words = prose(raw).replace(/\s+/g, " ").trim()
  const parts = words.split(MARKS).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const law_name = titleCase(
    (new RegExp(`^TITLE\\s+${number}\\s*-\\s*([A-Z][A-Z ,'&\\u2014-]*?)(?=\\s+CHAPTER\\b|$)`).exec(parts[0])?.[1] ?? "").trim()
  )

  const nodes = [
    { location_id: "TITLE", doc_type: "TITLE", doc_level_id: number, title: law_name || `Title ${number}`, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["TITLE"])
  let parent = "TITLE"

  for (const part of parts) {
    const chapter = /^CHAPTER\s+(\d+[A-Z]?)\s+-\s+(.*)$/s.exec(part)
    if (chapter) {
      const location_id = unique(`ch${chapter[1]}`, seen)
      seen.add(location_id)
      // The heading runs to the first section number after it.
      const name = chapter[2].split(/\b\d{1,2}-\d{1,2}-\d{3}/)[0]
      nodes.push({
        location_id,
        doc_type: "CHAPTER",
        doc_level_id: chapter[1],
        title: titleCase(name.trim()) || null,
        parent_location_id: "TITLE",
        depth: 1,
      })
      parent = location_id
      continue
    }
    const m = /^(\d{1,2}-\d{1,2}-\d{3}(?:\.\d+)?)\.\s+(.*)$/s.exec(part)
    if (!m) continue
    const location_id = unique(m[1], seen)
    seen.add(location_id)
    const rest = m[2].trim()
    const cut = /^(.{2,160}?\.)\s+(?=\S)/.exec(rest)
    nodes.push({
      location_id,
      doc_type: "SECTION",
      doc_level_id: m[1],
      title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
      parent_location_id: parent,
      depth: 2,
      repealed: /\brepealed\b/i.test(rest.slice(0, 120)),
      text: part,
    })
  }
  if (!nodes.some((n) => n.doc_type === "SECTION")) return null
  return { law_id: `T${number}`, law_name: law_name || `Title ${number}`, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
