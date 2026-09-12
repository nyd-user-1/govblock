// Michigan — the Compiled Laws, from the Legislative Service Bureau.
//
// `legislature.mi.gov` was rebuilt and the old MCL paths answer 400, which is
// why this state sat open. The Bureau still renders a whole chapter in one
// document; the address moved to `/Home/RenderDoc?objectName=mcl-chapN`, and
// `/Laws/ChapterIndex` names every chapter there is.
//
// The render is the Bureau's own print view: a `div.statuteWrapper` per act
// the chapter draws from, a `div.sectionWrapper` per section with its number
// and catchline in a heading, the law under it, and a `div.editorials` block
// holding the History and the Compiler's Notes. Michigan has no vendor in
// front of its Compiled Laws, so the Bureau's notes are taken with the law.
//
// A law here is a chapter, which is the unit Michigan's index uses: "MCL 8.1"
// is section 1 of chapter 8.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.legislature.mi.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

export default {
  id: "mi-lsb",
  name: "Michigan Legislative Service Bureau — the Michigan Compiled Laws",
  states: ["MI"],
  source: "https://www.legislature.mi.gov/Laws/ChapterIndex",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/Laws/ChapterIndex`)
    const chapters = []
    for (const row of elements(index, "tr")) {
      // The index also carries an "mcl-chapters" object, which is the index
      // of itself rather than a chapter.
      const a = [...elements(row.inner, "a")].find((x) => /objectName=mcl-chap\d/i.test(attrs(x.head).href ?? ""))
      if (!a) continue
      const number = /objectName=mcl-chap(\d[0-9A-Za-z]*)/i.exec(attrs(a.head).href ?? "")[1]
      if (chapters.some((c) => c.number === number)) continue
      const cells = [...elements(row.inner, "td")].map((td) => line(td.inner).trim())
      const name = cells.find((c) => c && !new RegExp(`^(chapter\\s*)?${number}$`, "i").test(c)) ?? ""
      chapters.push({ number, name: titleCase(name) || null })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0
    const documents = await map(wanted, 8, async (c) => {
      const html = await fetchDoc(state, `${BASE}/Home/RenderDoc?objectName=mcl-chap${c.number}`, { notFound: null })
      at += 1
      if (at % 50 === 0) log(`${at}/${wanted.length} chapters fetched`)
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
          title: chapter.name,
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["CHAPTER"])
      for (const node of readChapter(html, seen)) nodes.push(node)
      if (!nodes.some((n) => n.doc_type === "SECTION")) {
        log(`· chapter ${chapter.number} — the render carries no section`)
        continue
      }
      log(`C${chapter.number} · ${nodes.filter((n) => n.doc_type === "SECTION").length} sections · ${chapter.name}`)
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
 * A chapter's render: the acts it draws from, and the sections under each.
 *
 * A `statuteWrapper` opens an act — "Revised Statutes of 1846 (EXCERPT)" — and
 * every `sectionWrapper` after it belongs to that act until the next one.
 */
function* readChapter(html, seen) {
  const body = html.slice(html.indexOf("<body"))
  const marks = []
  for (const d of elements(body, "div", cls("statuteWrapper"))) marks.push({ at: d.index, kind: "ACT", inner: d.inner })
  for (const d of elements(body, "div", cls("sectionWrapper"))) marks.push({ at: d.index, kind: "SECTION", inner: d.inner })
  marks.sort((a, b) => a.at - b.at)

  let parent = "CHAPTER"
  for (const mark of marks) {
    if (mark.kind === "ACT") {
      // The act's own heading is the first line of its wrapper; the sections
      // inside it follow as wrappers of their own.
      const heading = line([...elements(mark.inner, "h1")][0]?.inner ?? "").replace(/\s+/g, " ").trim()
      if (!heading) continue
      const location_id = unique(`act-${seen.size}`, seen)
      seen.add(location_id)
      yield {
        location_id,
        doc_type: "ARTICLE",
        doc_level_id: "",
        title: titleCase(heading.replace(/\s*\(EXCERPT\)\s*$/i, "")) || null,
        parent_location_id: "CHAPTER",
        depth: 1,
      }
      parent = location_id
      continue
    }
    const heading = line([...elements(mark.inner, "h1")][0]?.inner ?? "").replace(/\s+/g, " ").trim()
    const m = /^([0-9A-Za-z][0-9A-Za-z.-]*)\s+(.*)$/s.exec(heading)
    if (!m) continue
    const location_id = unique(m[1], seen)
    seen.add(location_id)
    yield {
      location_id,
      doc_type: "SECTION",
      doc_level_id: m[1],
      title: titleCase(m[2].replace(/\.$/, "")) || null,
      parent_location_id: parent,
      depth: 2,
      repealed: /\brepealed\b/i.test(m[2]),
      text: text(mark.inner) || null,
    }
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
