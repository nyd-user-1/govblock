// Ohio — the Revised Code, from the Legislative Service Commission.
//
// `codes.ohio.gov` looks like a per-section site and is not: the chapter page
// carries every one of its sections in full, each as a `content-head` naming
// it and a `<section class="laws-body">` holding the law, with the effective
// date and the act that last amended it beside them. So Ohio is about two
// thousand documents rather than thirty-five thousand.
//
// A law here is a chapter, which is the unit Ohio cites: "R.C. 1.01" is
// section 01 of chapter 1. The title above it is named on the chapter, the way
// Massachusetts's parts and Oregon's titles are, because the table holds one
// tree per law.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://codes.ohio.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

export default {
  id: "oh-lsc",
  name: "Ohio Legislative Service Commission — the Revised Code",
  states: ["OH"],
  source: "https://codes.ohio.gov/ohio-revised-code",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/ohio-revised-code`)
    const titles = []
    for (const a of elements(index, "a")) {
      const href = attrs(a.head).href ?? ""
      const m = /ohio-revised-code\/(title-[0-9A-Za-z-]+|general-provisions)$/.exec(href)
      if (!m || titles.some((t) => t.slug === m[1])) continue
      titles.push({ slug: m[1], name: titleCase(line(a.inner)) })
    }
    log(`${titles.length} titles`)

    // Which title each chapter belongs to, and in what order — the title pages
    // are the Commission's own arrangement of the Code.
    const chapters = []
    await map(titles, 8, async (title) => {
      const page = await fetchDoc(state, `${BASE}/ohio-revised-code/${title.slug}`, { notFound: null })
      for (const a of elements(page ?? "", "a")) {
        const m = /(?:^|\/)chapter-([0-9A-Za-z.-]+)$/.exec(attrs(a.head).href ?? "")
        if (!m) continue
        const label = line(a.inner)
        const named = /^Chapter\s+[0-9A-Za-z.-]+\s*\|?\s*(.*)$/i.exec(label)
        chapters.push({ number: m[1], title: title.name, name: titleCase(named ? named[1] : label) })
      }
    })
    const wanted = []
    for (const chapter of chapters) {
      if (wanted.some((c) => c.number === chapter.number)) continue
      if (only && `C${chapter.number}` !== only.toUpperCase()) continue
      if (have?.has(`C${chapter.number}`)) continue
      wanted.push(chapter)
    }
    log(`${chapters.length} chapters, ${wanted.length} to read`)

    let at = 0
    const documents = await map(wanted, 12, async (chapter) => {
      const html = await fetchDoc(state, `${BASE}/ohio-revised-code/chapter-${chapter.number}`, { notFound: null })
      at += 1
      if (at % 200 === 0) log(`${at}/${wanted.length} chapters fetched`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const chapter = wanted[i]
      const html = documents[i]
      if (!html) {
        log(`✗ chapter ${chapter.number} — no document`)
        continue
      }
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
      for (const node of readChapter(html, seen)) nodes.push(node)
      if (nodes.length < 2) {
        log(`· chapter ${chapter.number} — the page carries no section`)
        continue
      }
      log(`C${chapter.number} · ${nodes.length - 1} sections · ${chapter.name}`)
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
 * One chapter page: each section's heading, the dates and act beside it, and
 * the words of the law.
 *
 * The headings and the bodies are separate elements in the same order, so they
 * are read in parallel rather than by looking inside one for the other.
 */
function* readChapter(html, seen) {
  const heads = [...elements(html, "span", cls("content-head-text"))]
  const bodies = [...elements(html, "section", cls("laws-body"))]
  for (let i = 0; i < heads.length; i++) {
    const label = line(heads[i].inner)
    const m = /^Section\s+([0-9A-Za-z][0-9A-Za-z.-]*)\s*\|?\s*(.*)$/i.exec(label)
    if (!m) continue
    const location_id = unique(m[1], seen)
    seen.add(location_id)
    const body = bodies[i] ? text(bodies[i].inner) : ""
    // The effective date and the act that last amended the section are the
    // law's own provenance, and the Commission prints them with it.
    const info = infoAfter(html, heads[i].end, bodies[i]?.index ?? heads[i].end)
    yield {
      location_id,
      doc_type: "SECTION",
      doc_level_id: m[1],
      title: titleCase(m[2].replace(/\.$/, "")) || null,
      parent_location_id: "CHAPTER",
      depth: 1,
      repealed: /\brepealed\b/i.test(m[2]),
      text: [`${m[1]} ${m[2]}`.trim(), body, info].filter(Boolean).join("\n\n") || null,
    }
  }
}

/** The labelled facts the page prints between a section's heading and its body. */
function infoAfter(html, from, to) {
  if (to <= from) return ""
  const fragment = html.slice(from, to)
  const out = []
  for (const module of elements(fragment, "div", cls("laws-section-info-module"))) {
    const label = firstOf(module.inner, "label")
    const value = firstOf(module.inner, "value")
    // The link to the authenticated PDF is the site's, not the law's.
    if (!label || !value || /^PDF/i.test(label)) continue
    out.push(`${label.replace(/:\s*$/, "")}: ${value}`)
  }
  return out.join("\n")
}

function firstOf(html, name) {
  for (const e of elements(html, "div", cls(name))) return line(e.inner)
  return null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
