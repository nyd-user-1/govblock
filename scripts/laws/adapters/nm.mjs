// New Mexico — the Statutes Annotated 1978, from the Compilation Commission.
//
// `nmonesource.com` is Lexum's viewer and draws itself on the client, which is
// why this state sat blocked. Its own frame answers a plain request —
// `nav_date.do?iframe=true` lists every chapter, paged — and each chapter's
// item page links one document: `/{id}/1/document.do`, which is the whole of
// the chapter as a PDF the Commission typeset.
//
// The Commission publishes the Statutes under contract and the printed edition
// is annotated; the PDF served here is the statute, and that is what is taken.
//
// A law here is a chapter, which is what New Mexico cites: "NMSA 1978, § 3-1-1"
// is chapter 3, article 1, section 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { fetchPdf, prose } from "../lib/pdf.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://nmonesource.com/nmos/nmsa/en"

// "3-1-1. Short title." — the chapter, the article, the section, then the
// catchline. New Mexico also numbers sections with letters and decimals.
const OPENS = /(?=\b\d{1,2}[A-Z]?-\d{1,2}[A-Z]?-\d{1,3}(?:\.\d+)?\.\s)/g

// The Commission's annotated edition prints its research layer under each
// section — law reviews, Am. Jur., C.J.S. The History line above it is the
// section's own provenance and stays with it, on the same terms as
// California's enacting line.
const ANNOTATIONS = /\sANNOTATIONS\s/

export default {
  id: "nm-nmcc",
  name: "New Mexico Compilation Commission — the Statutes Annotated 1978",
  states: ["NM"],
  source: "https://nmonesource.com/nmos/nmsa/en/nav_date.do",

  async *laws({ state, only, have, log }) {
    // The listing is paged; each page names its chapters and links their items.
    const chapters = []
    for (let page = 1; page <= 20; page++) {
      const html = await fetchDoc(state, `${BASE}/nav_date.do?iframe=true${page > 1 ? `&page=${page}` : ""}`, { notFound: null })
      if (!html) break
      let found = 0
      for (const a of elements(html, "a")) {
        const id = /\/nmos\/nmsa\/en\/item\/(\d+)\/index\.do$/.exec(attrs(a.head).href ?? "")?.[1]
        if (!id) continue
        const label = line(a.inner).replace(/\s+/g, " ").trim()
        const m = /^Chapter\s+([0-9A-Za-z]+)\s*[-–—]\s*(.*)$/i.exec(label)
        if (!m || chapters.some((c) => c.number === m[1])) continue
        chapters.push({ id, number: m[1], name: titleCase(m[2]) })
        found += 1
      }
      if (!found) break
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0
    const documents = await map(wanted, 6, async (c) => {
      const pdf = await fetchPdf(state, `${BASE}/${c.id}/1/document.do`, { notFound: null }).catch(() => null)
      at += 1
      if (at % 10 === 0) log(`${at}/${wanted.length} chapters fetched`)
      return pdf
    })

    for (let i = 0; i < wanted.length; i++) {
      const raw = documents[i]
      if (!raw) {
        log(`✗ chapter ${wanted[i].number} — no document`)
        continue
      }
      const law = read(raw, wanted[i])
      if (!law) {
        log(`· chapter ${wanted[i].number} — the file carries no section`)
        continue
      }
      log(`C${wanted[i].number} · ${law.nodes.length - 1} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(raw, chapter) {
  const words = prose(raw).replace(/\s+/g, " ").trim()
  const parts = words.split(OPENS).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const nodes = [
    { location_id: "CHAPTER", doc_type: "CHAPTER", doc_level_id: chapter.number, title: chapter.name, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["CHAPTER"])
  // The chapter prints its contents before its text, so a number appears twice
  // and the one carrying the law is the longer of them.
  const best = new Map()
  for (const part of parts) {
    const m = /^(\d{1,2}[A-Z]?-\d{1,2}[A-Z]?-\d{1,3}(?:\.\d+)?)\.\s+(.*)$/s.exec(part)
    if (!m) continue
    if (!m[1].startsWith(chapter.number + "-")) continue
    const previous = best.get(m[1])
    if (!previous || part.length > previous.part.length) best.set(m[1], { part, rest: m[2] })
  }
  if (!best.size) return null

  for (const [number, { part, rest }] of best) {
    seen.add(number)
    const cut = /^(.{2,200}?\.)\s+(?=\S)/.exec(rest)
    nodes.push({
      location_id: number,
      doc_type: "SECTION",
      doc_level_id: number,
      title: titleCase((cut ? cut[1] : rest.slice(0, 200)).replace(/\.$/, "")) || null,
      parent_location_id: "CHAPTER",
      depth: 1,
      repealed: /\brepealed\b/i.test(rest.slice(0, 120)),
      text: cutAnnotations(part),
    })
  }
  return {
    law_id: `C${chapter.number}`,
    law_name: chapter.name || `Chapter ${chapter.number}`,
    law_type: "CONSOLIDATED",
    chapter: chapter.number,
    nodes: inOrder(nodes),
  }
}

/** A section without the annotations the Commission prints under it. */
function cutAnnotations(part) {
  const at = part.search(ANNOTATIONS)
  return (at > 0 ? part.slice(0, at) : part).trim()
}
