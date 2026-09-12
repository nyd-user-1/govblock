// South Carolina — the Code of Laws, from the Legislative Council.
//
// `scstatehouse.gov/code` publishes the whole of a chapter on one page, and
// sets the Council's own arrangement as centred lines above the sections it
// covers — "CHAPTER 1", its name, then "ARTICLE 1" and its name — with each
// section opening in bold: "SECTION 1-1-10." followed by its catchline and
// then the words of the law.
//
// The site says of itself that it is the unannotated Code, which is exactly
// the layer this project wants: the statute as the Council publishes it, with
// nobody's headnotes on top.
//
// A law here is a title, which is how South Carolina arranges the Code and how
// it cites: "S.C. Code § 1-1-10" is title 1, chapter 1, section 10.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.scstatehouse.gov/code"

const KINDS = { CHAPTER: "CHAPTER", ARTICLE: "ARTICLE", SUBARTICLE: "SUBARTICLE", PART: "PART", SUBPART: "SUBPART", DIVISION: "DIVISION" }

export default {
  id: "sc-statehouse",
  name: "South Carolina Legislative Council — the Code of Laws (unannotated)",
  states: ["SC"],
  source: "https://www.scstatehouse.gov/code/statmast.php",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/statmast.php`)
    const titles = []
    // "Title 1 - Administration of the Government", the link on the number and
    // the name in the text beside it.
    for (const m of index.matchAll(/<a href="\/code\/title(\d+)\.php">[^<]*<\/a>\s*-\s*([^<]+)/g)) {
      if (titles.some((t) => t.number === m[1])) continue
      titles.push({ number: m[1], name: titleCase(m[2].replace(/\s+/g, " ").trim()) })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const law_id = `T${title.number}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const contents = await fetchDoc(state, `${BASE}/title${title.number}.php`, { notFound: null })
      const chapters = []
      for (const a of elements(contents ?? "", "a")) {
        const m = /\/code\/t(\d+)c(\d+)\.php$/.exec(attrs(a.head).href ?? "")
        if (!m || m[1] !== title.number.padStart(2, "0") || chapters.some((c) => c.slug === m[0])) continue
        chapters.push({ slug: m[0], number: String(Number(m[2])), url: `${BASE}/t${m[1]}c${m[2]}.php` })
      }
      if (!chapters.length) {
        log(`✗ ${law_id} — the contents list no chapters`)
        continue
      }

      const documents = await map(chapters, 10, (chapter) => fetchDoc(state, chapter.url, { notFound: null }))

      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: title.number, title: title.name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      let sections = 0

      for (let i = 0; i < chapters.length; i++) {
        const html = documents[i]
        if (!html) {
          log(`✗ ${law_id} chapter ${chapters[i].number} — no document`)
          continue
        }
        for (const node of readChapter(html, chapters[i].number, seen)) {
          nodes.push(node)
          seen.add(node.location_id)
          if (node.doc_type === "SECTION") sections += 1
        }
      }

      log(`${law_id} · ${chapters.length} chapters · ${sections.toLocaleString("en-US")} sections`)
      yield { law_id, law_name: title.name, law_type: "CONSOLIDATED", chapter: title.number, nodes: inOrder(nodes) }
    }
  },
}

/**
 * One chapter page, read top to bottom.
 *
 * The page's contents section is a flat run of `div`s and text: the centred
 * divs are headings, and a bold `SECTION` opens a section that runs until the
 * next heading or the next section.
 */
function* readChapter(html, number, seen) {
  const from = html.indexOf('id="contentsection"')
  const body = from < 0 ? html : html.slice(from)
  const chapterId = `ch${number}`
  // Held rather than yielded at once: the page prints the chapter's name on
  // the line under its number, and the node is filled in when that arrives.
  const chapterNode = { location_id: chapterId, doc_type: "CHAPTER", doc_level_id: number, title: null, parent_location_id: "TITLE", depth: 1 }
  yield chapterNode
  seen.add(chapterId)

  let parent = chapterId
  let open = null
  let lines = []
  let heading = null

  const close = function* () {
    if (!open) return
    yield {
      location_id: open.location_id,
      doc_type: "SECTION",
      doc_level_id: open.number,
      title: open.title,
      parent_location_id: open.parent,
      depth: 0,
      repealed: /\brepealed\b/i.test(open.title ?? ""),
      text: [`SECTION ${open.number}. ${open.title ?? ""}`.trim(), ...lines].filter(Boolean).join("\n\n") || null,
    }
    open = null
    lines = []
  }

  for (const block of blocks(body)) {
    const flat = block.text
    if (!flat) continue

    const opening = /^SECTION\s+([0-9A-Za-z][0-9A-Za-z.-]*)\.\s*(.*)$/s.exec(flat)
    if (opening) {
      yield* close()
      const location_id = unique(opening[1], seen)
      seen.add(location_id)
      // "SECTION 1-1-10. Jurisdiction and boundaries of the State." — the
      // catchline ends at its full stop and the law begins after it.
      const rest = opening[2].replace(/\s+/g, " ").trim()
      const cut = /^(.*?\.)(?:\s+|$)/.exec(rest)
      open = {
        location_id,
        number: opening[1],
        title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
        parent,
      }
      lines = cut ? [rest.slice(cut[0].length).trim()] : []
      continue
    }

    if (block.centred) {
      const m = /^(CHAPTER|ARTICLE|SUBARTICLE|PART|SUBPART|DIVISION)\s+([0-9A-Za-z.-]+)\.?$/i.exec(flat)
      if (m && KINDS[m[1].toUpperCase()]) {
        yield* close()
        heading = { doc_type: KINDS[m[1].toUpperCase()], doc_level_id: m[2] }
        continue
      }
      // The line under a heading is its name, and the line under "CHAPTER n"
      // names the chapter this page is.
      if (heading) {
        // The line under "CHAPTER n" is the chapter's own name, and the
        // chapter node is already open.
        if (heading.doc_type === "CHAPTER") {
          const chapter = chapterNode
          if (chapter && !chapter.title) chapter.title = titleCase(flat)
          heading = null
          continue
        }
        const location_id = unique(`${heading.doc_type.toLowerCase()}-${heading.doc_level_id}`, seen)
        seen.add(location_id)
        yield { location_id, ...heading, title: titleCase(flat), parent_location_id: chapterId, depth: 2 }
        parent = location_id
        heading = null
        continue
      }
      continue
    }

    if (open) lines.push(flat)
  }
  yield* close()
}

/**
 * The page's paragraphs, in the order they are printed.
 *
 * The Council writes a chapter as a flat run of centred `div` headings with
 * the sections between them as plain text broken by `<br />`, so this walks
 * the source once rather than gathering the divs and the text separately —
 * which would put every heading before every section.
 */
function* blocks(html) {
  const div = /<div\b[^>]*>/gi
  let at = 0
  let m
  while ((m = div.exec(html))) {
    yield* loose(html.slice(at, m.index))
    const end = closeOfDiv(html, div.lastIndex)
    const inner = html.slice(div.lastIndex, end.at)
    // A div holding other divs is a wrapper; walk into it rather than past it.
    if (/<div\b/i.test(inner)) {
      yield* blocks(inner)
    } else {
      const centred = /text-align:\s*center/i.test(m[0])
      for (const part of text(inner).split("\n")) {
        const flat = part.trim()
        if (flat) yield { text: flat, centred }
      }
    }
    at = end.past
    div.lastIndex = end.past
  }
  yield* loose(html.slice(at))
}

/** Text outside any div, one paragraph per line break the source printed. */
function* loose(fragment) {
  for (const part of text(fragment).split("\n")) {
    const flat = part.trim()
    if (flat) yield { text: flat, centred: false }
  }
}

function closeOfDiv(html, from) {
  const find = /<(\/?)div\b[^>]*>/gi
  find.lastIndex = from
  let depth = 1
  let m
  while ((m = find.exec(html))) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return { at: m.index, past: m.index + m[0].length }
  }
  return { at: html.length, past: html.length }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
