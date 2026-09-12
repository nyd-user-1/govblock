// Kentucky — the Kentucky Revised Statutes, from the Legislative Research
// Commission.
//
// `apps.legislature.ky.gov/law/statutes/` lists every chapter under its title,
// a chapter page lists its sections, and a section is served as a PDF of one
// page — the Commission's own typesetting, text and all, with the effective
// date and the acts that made it printed under the law.
//
// The Commission says on its own index that chapter titles, centred headings
// and section catchlines "are for informational purposes only and do not
// constitute any part of the law". They are kept anyway, as the tree and the
// headings a reader navigates by, which is what they are for.
//
// A law here is a chapter, which is what Kentucky cites: "KRS 1.010" is
// section 010 of chapter 1. The title above it is named on the chapter.
import { fetchDoc, map } from "../lib/pool.mjs"
import { fetchPdf, prose } from "../lib/pdf.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://apps.legislature.ky.gov/law/statutes"

export default {
  id: "ky-lrc",
  name: "Kentucky Legislative Research Commission — the Kentucky Revised Statutes",
  states: ["KY"],
  source: "https://apps.legislature.ky.gov/law/statutes/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/`)
    // The index is a list of titles, each with its chapters under it; a chapter
    // Kentucky has not used yet is printed without a link.
    const chapters = []
    let title = null
    for (const mark of ordered(index)) {
      if (mark.kind === "TITLE") {
        title = mark.name
        continue
      }
      if (chapters.some((c) => c.number === mark.number)) continue
      chapters.push({ ...mark, title })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0

    for (const chapter of wanted) {
      at += 1
      if (at % 25 === 0) log(`${at}/${wanted.length} chapters`)
      const page = await fetchDoc(state, `${BASE}/${chapter.href}`, { notFound: null })
      if (!page) continue
      const listed = []
      for (const a of elements(page, "a")) {
        const href = attrs(a.head).href ?? ""
        if (!/^statute\.aspx\?id=\d+$/.test(href)) continue
        const label = line(a.inner).replace(/\s+/g, " ").trim()
        const m = /^\.?([0-9A-Za-z-]+)\s+(.*)$/.exec(label)
        if (!m || listed.some((s) => s.href === href)) continue
        listed.push({
          href,
          number: `${chapter.number}.${m[1].replace(/^\./, "")}`,
          name: titleCase(m[2].replace(/\.$/, "")) || null,
        })
      }
      if (!listed.length) continue

      const bodies = await map(listed, 8, (s) => fetchPdf(state, `${BASE}/${s.href}`, { notFound: null }).catch(() => null))

      const nodes = [
        {
          location_id: "CHAPTER",
          doc_type: "CHAPTER",
          doc_level_id: chapter.number,
          title: [chapter.name, chapter.title].filter(Boolean).join(" — "),
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["CHAPTER"])
      for (let i = 0; i < listed.length; i++) {
        const section = listed[i]
        const location_id = unique(section.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: section.number,
          title: section.name,
          parent_location_id: "CHAPTER",
          depth: 1,
          repealed: /\brepealed\b/i.test(section.name ?? ""),
          text: bodies[i] ? prose(bodies[i]) : `${section.number} ${section.name ?? ""}`.trim(),
        })
      }

      log(`C${chapter.number} · ${listed.length} sections · ${chapter.name}`)
      yield {
        law_id: `C${chapter.number}`,
        law_name: chapter.name || `Chapter ${chapter.number}`,
        law_type: "CONSOLIDATED",
        chapter: chapter.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

/** The index read top to bottom: a title, then the chapters under it. */
function* ordered(html) {
  const marks = []
  for (const s of elements(html, "span", /id="title"/)) marks.push({ at: s.index, kind: "TITLE", html: s.inner })
  for (const a of elements(html, "a")) {
    const href = attrs(a.head).href ?? ""
    if (/^chapter\.aspx\?id=\d+$/.test(href)) marks.push({ at: a.index, kind: "CHAPTER", href, html: a.inner })
  }
  marks.sort((a, b) => a.at - b.at)
  for (const mark of marks) {
    const flat = line(mark.html).replace(/\s+/g, " ").trim()
    if (!flat) continue
    if (mark.kind === "TITLE") {
      const m = /^TITLE\s+[0-9IVXLC]+\s*(.*)$/i.exec(flat)
      yield { kind: "TITLE", name: titleCase(m ? m[1] : flat) || null }
      continue
    }
    const m = /^CHAPTER\s+([0-9A-Za-z]+)\s*(.*)$/i.exec(flat)
    if (!m) continue
    yield { kind: "CHAPTER", number: m[1], name: titleCase(m[2]) || null, href: mark.href }
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
