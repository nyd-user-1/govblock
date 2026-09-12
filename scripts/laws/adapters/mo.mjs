// Missouri — the Revised Statutes, from the Revisor of Statutes.
//
// `revisor.mo.gov` is three pages: the home page lists every chapter under the
// titles that hold them, a chapter lists its sections, and a section carries
// the law — the number and catchline in bold, an em dash, and then the words,
// with the acts that made it printed under them.
//
// A law here is a chapter, which is the unit Missouri cites: "§ 1.010 RSMo" is
// section 010 of chapter 1. The title above it is named on the chapter.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://revisor.mo.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

export default {
  id: "mo-revisor",
  name: "Missouri Revisor of Statutes — the Revised Statutes of Missouri",
  states: ["MO"],
  source: "https://revisor.mo.gov/main/Home.aspx",

  async *laws({ state, only, have, log }) {
    const home = await fetchDoc(state, `${BASE}/main/Home.aspx`)
    // The home page prints each title as a heading with its chapters under it,
    // so the title a chapter belongs to is the last heading above its link.
    const chapters = []
    let title = null
    for (const mark of ordered(home)) {
      if (mark.kind === "TITLE") {
        title = mark.name
        continue
      }
      if (chapters.some((c) => c.number === mark.number)) continue
      chapters.push({ number: mark.number, name: mark.name, title })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    const contents = await map(wanted, 10, (c) => fetchDoc(state, `${BASE}/main/OneChapter.aspx?chapter=${c.number}`, { notFound: null }))

    for (let i = 0; i < wanted.length; i++) {
      const chapter = wanted[i]
      const page = contents[i]
      if (!page) {
        log(`✗ chapter ${chapter.number} — no contents page`)
        continue
      }
      const listed = []
      for (const row of elements(page, "tr")) {
        const a = [...elements(row.inner, "a")].find((x) => /PageSelect\.aspx\?section=/.test(attrs(x.head).href ?? ""))
        if (!a) continue
        const number = /section=([0-9A-Za-z.]+)/.exec(attrs(a.head).href ?? "")?.[1]
        if (!number || listed.some((s) => s.number === number)) continue
        const cells = [...elements(row.inner, "td")].map((td) => line(td.inner))
        const headnote = (cells[1] ?? "").replace(/\s*\([0-9/]+\)\s*$/, "").trim()
        listed.push({ number, name: titleCase(headnote.replace(/\s*\.\.\.$/, "")) || null, truncated: /\.\.\.$/.test(headnote) })
      }
      if (!listed.length) {
        log(`· chapter ${chapter.number} — the contents list no section`)
        continue
      }

      const bodies = await map(listed, 12, (s) =>
        fetchDoc(state, `${BASE}/main/OneSection.aspx?section=${s.number}`, { notFound: null })
      )

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
      for (let j = 0; j < listed.length; j++) {
        const section = listed[j]
        const location_id = unique(section.number, seen)
        seen.add(location_id)
        const body = bodies[j] ? readSection(bodies[j]) : null
        // The chapter's contents truncate a long headnote with an ellipsis. A
        // truncated one is replaced by what the section itself prints: the
        // headnote runs to the last em dash before the law, and Missouri uses
        // em dashes inside the headnote too, so the last one is the boundary.
        const printed =
          section.truncated && body
            ? /^[0-9A-Za-z.]+\.\s*(.*)\s+\u2014\s/s.exec(body.replace(/\s+/g, " "))?.[1]
            : null
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: section.number,
          title: printed ? titleCase(printed.replace(/\.$/, "")) : section.name,
          parent_location_id: "CHAPTER",
          depth: 1,
          repealed: /\brepealed\b/i.test(section.name ?? ""),
          text: body ?? `${section.number}. ${section.name ?? ""}`.trim(),
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

/**
 * The home page read top to bottom: a title heading, then the chapters under
 * it, then the next title.
 */
function* ordered(html) {
  const marks = []
  for (const tag of ["h2", "h3", "h4"]) for (const h of elements(html, tag)) marks.push({ at: h.index, kind: "TITLE", html: h.inner })
  for (const a of elements(html, "a")) {
    const number = /OneChapter\.aspx\?chapter=([0-9A-Za-z.]+)$/.exec(attrs(a.head).href ?? "")?.[1]
    if (number) marks.push({ at: a.index, kind: "CHAPTER", number, html: a.inner })
  }
  marks.sort((a, b) => a.at - b.at)
  for (const mark of marks) {
    const flat = line(mark.html).replace(/\s+/g, " ").trim()
    if (!flat) continue
    if (mark.kind === "TITLE") {
      const m = /^TITLE\s+[IVXLC]+\s*[.:]?\s*(.*)$/i.exec(flat)
      if (m) yield { kind: "TITLE", name: titleCase(m[1]) || null }
      continue
    }
    // "1. Laws in Force and Construction of Statutes" — the number is in the
    // address and the name is the text beside it.
    yield { kind: "CHAPTER", number: mark.number, name: titleCase(flat.replace(/^[0-9A-Za-z.]+\s*[.:-]?\s*/, "")) || null }
  }
}

/** A section page: the number and catchline in bold, then the law. */
function readSection(html) {
  for (const block of elements(html, "div", cls("norm"))) {
    const words = text(block.inner)
    if (words) return words
  }
  return null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
