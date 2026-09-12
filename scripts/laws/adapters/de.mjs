// Delaware — the Delaware Code, from the Code Revisors.
//
// `delcode.delaware.gov` publishes the Code as one page per chapter, and the
// pages are generated from the Revisors' own XML — a `<div class="Section">`
// per section, a `SectionHead` carrying its number and catchline, and a
// `p.subsection` per lettered subsection, with the session laws that made it
// printed under the last one.
//
// A law here is a title, which is how Delaware cites: "1 Del. C. § 101" is
// section 101 of Title 1. The chapters and subchapters are levels inside it.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://delcode.delaware.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

export default {
  id: "de-delcode",
  name: "Delaware Code Revisors — the Delaware Code Online",
  states: ["DE"],
  source: "https://delcode.delaware.gov/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/`)
    const titles = []
    for (const a of elements(index, "a")) {
      const href = (attrs(a.head).href ?? "").replace(/\s+/g, "")
      const m = /^\.?\/?title([0-9A-Za-z]+)\/index\.html$/.exec(href)
      if (!m || titles.some((t) => t.number === m[1])) continue
      titles.push({ number: m[1], name: titleCase(line(a.inner).replace(/^Title\s+[0-9A-Za-z]+\s*-\s*/i, "")) })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const law_id = `T${title.number.toUpperCase()}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const contents = await fetchDoc(state, `${BASE}/title${title.number}/index.html`)
      const chapters = []
      for (const a of elements(contents, "a")) {
        const href = (attrs(a.head).href ?? "").replace(/\s+/g, "")
        const m = new RegExp(`title${title.number}/(c[0-9A-Za-z]+)/index\\.html$`).exec(href)
        if (!m || chapters.some((c) => c.slug === m[1])) continue
        const label = line(a.inner)
        const named = /^Chapter\s+([0-9A-Za-z]+)\.?\s*(.*)$/i.exec(label)
        chapters.push({ slug: m[1], number: named ? named[1] : m[1].replace(/^c0*/, ""), name: titleCase(named ? named[2] : label) })
      }
      if (!chapters.length) {
        log(`✗ ${law_id} — the contents list no chapters`)
        continue
      }

      const documents = await map(chapters, 12, (chapter) =>
        fetchDoc(state, `${BASE}/title${title.number}/${chapter.slug}/index.html`, { notFound: null })
      )

      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: title.number, title: title.name || `Title ${title.number}`, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      let sections = 0

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const chapterId = `c${chapter.number}`
        nodes.push({
          location_id: unique(chapterId, seen),
          doc_type: "CHAPTER",
          doc_level_id: chapter.number,
          title: chapter.name || null,
          parent_location_id: "TITLE",
          depth: 1,
        })
        seen.add(chapterId)
        const html = documents[i]
        if (!html) {
          log(`✗ ${law_id} chapter ${chapter.number} — no document`)
          continue
        }
        for (const node of readChapter(html, chapterId, seen)) {
          nodes.push(node)
          seen.add(node.location_id)
          if (node.doc_type === "SECTION") sections += 1
        }
      }

      log(`${law_id} · ${chapters.length} chapters · ${sections.toLocaleString("en-US")} sections`)
      yield {
        law_id,
        law_name: title.name || `Title ${title.number}`,
        law_type: "CONSOLIDATED",
        chapter: title.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

/**
 * One chapter page: its subchapters, named in the headings the page prints
 * above a run of sections, and the sections themselves.
 */
function* readChapter(html, chapterId, seen) {
  const body = html.slice(html.indexOf('id="CodeBody"'))
  for (const section of elements(body, "div", cls("Section"))) {
    const heads = [...elements(section.inner, "div", cls("SectionHead"))]
    if (!heads.length) continue
    const head = line(heads[0].inner).replace(/^§\s*/, "")
    const m = /^([0-9A-Za-z][0-9A-Za-z.-]*)\.\s*(.*)$/s.exec(head)
    if (!m) continue
    const number = m[1]
    const location_id = unique(number, seen)
    seen.add(location_id)
    // Everything after the heading is the section: its subsections, then the
    // session laws that made it, which Delaware prints without a wrapper.
    const words = text(section.inner.slice(heads[0].end))
    yield {
      location_id,
      doc_type: "SECTION",
      doc_level_id: number,
      title: titleCase(m[2].replace(/\.$/, "")) || null,
      parent_location_id: chapterId,
      depth: 2,
      repealed: /\brepealed\b/i.test(m[2]),
      text: [`§ ${number}. ${m[2]}`.trim(), words].filter(Boolean).join("\n\n") || null,
    }
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
