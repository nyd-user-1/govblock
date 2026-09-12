// West Virginia — the West Virginia Code, from the Legislature.
//
// `code.wvlegislature.gov/1/` is a whole chapter: a `div.art-head` opens each
// article, and every section inside it is a `div.sectiontext` with its number
// and catchline in an `h4` and the law in the paragraphs under it. The chapter
// list is the `<select>` the page uses to move between chapters, so the index
// comes back with the first request rather than needing one of its own.
//
// A law here is a chapter, which is how West Virginia cites: "W. Va. Code
// § 1-1-1" is chapter 1, article 1, section 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, hasClass as cls, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://code.wvlegislature.gov"

export default {
  id: "wv-legislature",
  name: "West Virginia Legislature — the West Virginia Code",
  states: ["WV"],
  source: "https://code.wvlegislature.gov/",

  async *laws({ state, only, have, log }) {
    const first = await fetchDoc(state, `${BASE}/1/`)
    const chapters = []
    for (const option of elements(first, "option")) {
      const number = /value=['"]([0-9A-Za-z]+)['"]/.exec(option.head)?.[1]
      if (!number || chapters.some((c) => c.number === number)) continue
      const label = line(option.inner).replace(/\s+/g, " ").trim()
      const named = new RegExp(`^CHAPTER\\s+${number}\\.?\\s*(.*)$`, "i").exec(label)
      if (!named) continue
      chapters.push({ number, name: titleCase(named[1].replace(/\.$/, "")) || null })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0

    for (const chapter of wanted) {
      at += 1
      if (at % 20 === 0) log(`${at}/${wanted.length} chapters`)
      const page = chapter.number === "1" ? first : await fetchDoc(state, `${BASE}/${chapter.number}/`, { notFound: null })
      if (!page) {
        log(`✗ chapter ${chapter.number} — no page`)
        continue
      }
      // The chapter names its articles, an article names its sections, and a
      // section page carries the law. The chapter page prints the articles'
      // headings but not their text, so all three levels are read.
      const articles = links(page, new RegExp(`^/${chapter.number}-([0-9A-Za-z]+)/$`))
      if (!articles.length) {
        log(`· chapter ${chapter.number} — no article`)
        continue
      }
      const headings = new Map()
      for (const d of elements(page, "div", cls("art-head"))) {
        const m = /^ARTICLE\s+([0-9A-Za-z]+)\.?\s*(.*)$/i.exec(line(d.inner).replace(/\s+/g, " ").trim())
        if (m) headings.set(m[1], titleCase(m[2].replace(/\.$/, "")) || null)
      }

      const lists = await map(articles, 10, (a) => fetchDoc(state, `${BASE}${a.href}`, { notFound: null }))
      const plan = []
      for (let i = 0; i < articles.length; i++) {
        plan.push({ kind: "ARTICLE", number: articles[i].id, name: headings.get(articles[i].id) ?? null })
        for (const s of links(lists[i] ?? "", new RegExp(`^/${chapter.number}-${articles[i].id}-([0-9A-Za-z.]+)/$`))) {
          plan.push({ kind: "SECTION", href: s.href, number: `${chapter.number}-${articles[i].id}-${s.id}` })
        }
      }
      const sections = plan.filter((p) => p.kind === "SECTION")
      if (!sections.length) {
        log(`· chapter ${chapter.number} — no section`)
        continue
      }
      const bodies = await map(sections, 12, (s) => fetchDoc(state, `${BASE}${s.href}`, { notFound: null }))

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
      let parent = "CHAPTER"
      let read = 0
      for (const item of plan) {
        if (item.kind === "ARTICLE") {
          const location_id = unique(`a${item.number}`, seen)
          seen.add(location_id)
          nodes.push({ location_id, doc_type: "ARTICLE", doc_level_id: item.number, title: item.name, parent_location_id: "CHAPTER", depth: 1 })
          parent = location_id
          continue
        }
        const html = bodies[read++]
        const body = html ? readSection(html, item.number) : null
        const location_id = unique(item.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: item.number,
          title: body?.title ?? null,
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(body?.title ?? ""),
          text: body?.text ?? null,
        })
      }
      if (!nodes.some((n) => n.text)) {
        log(`· chapter ${chapter.number} — no section carried text`)
        continue
      }
      log(`C${chapter.number} · ${sections.length} sections · ${chapter.name}`)
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

/** Every link on a page whose address matches, once each, in printed order. */
function links(html, match) {
  const out = []
  for (const a of elements(html, "a")) {
    const m = match.exec(attrs(a.head).href ?? "")
    if (!m || out.some((x) => x.id === m[1])) continue
    out.push({ href: m[0], id: m[1] })
  }
  return out
}

/** A section page: the number and catchline in its heading, and the law. */
function readSection(html, number) {
  const block = [...elements(html, "div", cls("sectiontext"))][0]
  if (!block) return null
  const heading = line([...elements(block.inner, "h4")][0]?.inner ?? "").replace(/\s+/g, " ").trim()
  const m = /^§+\s*([0-9A-Za-z][0-9A-Za-z.-]*)\.\s*(.*)$/s.exec(heading)
  return {
    title: m ? titleCase(m[2].replace(/\.$/, "")) || null : null,
    text: text(block.inner) || null,
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
