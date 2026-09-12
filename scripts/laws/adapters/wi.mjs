// Wisconsin — the Wisconsin Statutes, from the Legislative Reference Bureau.
//
// `docs.legis.wisconsin.gov/statutes/statutes` lists every chapter, and a
// chapter's page carries the whole of it: a `div.qsatxt_1sect` per section,
// with the number in `qsnum_sect`, the catchline in `qstitle_sect`, the law
// after them and the Bureau's history line under it. The page prints the
// chapter's own table of contents first, in `qstoc_entry` divs, which is the
// tree rather than the text.
//
// A law here is a chapter, which is what Wisconsin cites: "Wis. Stat. § 1.01"
// is section 01 of chapter 1. The subchapter headings the Bureau sets between
// sections are levels inside it.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://docs.legis.wisconsin.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

export default {
  id: "wi-lrb",
  name: "Wisconsin Legislative Reference Bureau — the Wisconsin Statutes",
  states: ["WI"],
  source: "https://docs.legis.wisconsin.gov/statutes/statutes",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/statutes/statutes`)
    // The index is a list, not a table: one paragraph per chapter, the number
    // in the link and the name after the dash that follows it.
    const chapters = []
    for (const p of elements(index, "p")) {
      const a = [...elements(p.inner, "a")].find((x) => /^\/document\/statutes\/[0-9]+[A-Za-z]*$/.test(attrs(x.head).href ?? ""))
      if (!a) continue
      const number = (attrs(a.head).href ?? "").split("/").pop()
      if (chapters.some((c) => c.number === number)) continue
      const flat = line(p.inner).replace(/\s+/g, " ").trim()
      const name = /\s[-\u2013\u2014]\s(.*)$/.exec(flat)?.[1] ?? ""
      chapters.push({ number, name: titleCase(name) || null })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0
    const contents = await map(wanted, 10, async (c) => {
      const html = await fetchDoc(state, `${BASE}/statutes/statutes/${c.number}`, { notFound: null })
      at += 1
      if (at % 100 === 0) log(`${at}/${wanted.length} chapter contents fetched`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const chapter = wanted[i]
      const page = contents[i]
      if (!page) {
        log(`✗ chapter ${chapter.number} — no contents page`)
        continue
      }
      // A short chapter comes back whole; a long one is paged, and its
      // contents name every section as a document of its own. Reading the
      // sections is the route that works for both, so it is the only route.
      const listed = await sectionsOf(state, page, chapter.number)
      if (!listed.length) {
        log(`· chapter ${chapter.number} — the contents name no section`)
        continue
      }
      const bodies = await map(listed, 12, (n) => fetchDoc(state, `${BASE}/document/statutes/${n}`, { notFound: null }))

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
      for (let j = 0; j < listed.length; j++) {
        const number = listed[j]
        const read = bodies[j] ? readSection(bodies[j], number) : null
        const location_id = unique(number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: number,
          title: read?.title ?? null,
          parent_location_id: "CHAPTER",
          depth: 1,
          repealed: /\brepealed\b/i.test(read?.title ?? ""),
          text: read?.text ?? null,
        })
      }
      if (!nodes.some((n) => n.text)) {
        log(`· chapter ${chapter.number} — no section carried text`)
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
 * Every section a chapter lists, following the Bureau's own paging.
 *
 * A short chapter's contents fit on one page; a long one ends with a "down"
 * link that continues the list from where it stopped, and chapter 48 needs
 * seven of them. The walk follows those links until the Bureau stops offering
 * one, which is how the whole of a chapter is named without guessing at
 * section numbers.
 */
async function sectionsOf(state, page, number) {
  const found = new Set()
  const take = (html) => {
    for (const entry of elements(html, "div", cls("qstoc_entry"))) {
      for (const a of elements(entry.inner, "a")) {
        const n = /^\/document\/statutes\/([0-9]+[A-Za-z]*\.[0-9A-Za-z.()-]+)$/.exec(attrs(a.head).href ?? "")?.[1]
        if (!n || n.endsWith(".pdf") || n.split(".")[0] !== number) continue
        found.add(n)
        break
      }
    }
  }
  take(page)
  // The Bureau's contents are a scrolling window, sixty entries at a time.
  for (let at = 1; at <= 3000; at += 60) {
    const html = await fetchDoc(state, `${BASE}/scroll/down/${at}/statutes/statutes/${number}`, { notFound: null })
    if (!html) break
    const before = found.size
    take(html)
    if (found.size === before && at > 61) break
  }
  return [...found].sort(byNumber)
}

/** A chapter's sections in the order Wisconsin numbers them, "48.02" before "48.022". */
function byNumber(a, b) {
  const parts = (n) => n.split(".").slice(1).join(".")
  const x = parts(a)
  const y = parts(b)
  return x === y ? 0 : x < y ? -1 : 1
}

/**
 * One section's page. The page also prints the whole chapter's contents, so
 * the section is found by the `data-section` its own block carries rather than
 * by taking the first block on the page.
 */
function readSection(html, number) {
  const block = [...elements(html, "div", cls("qsatxt_1sect"))].find((d) => attrs(d.head)["data-section"] === number)
  if (!block) return null
  const catchline = line([...elements(block.inner, "span", cls("qstitle_sect"))][0]?.inner ?? "")
  // The section opens with an invisible anchor carrying its own number, which
  // the number span then prints again.
  const words = text(block.inner.replace(/<a\b[^>]*class=["'][^"']*\breference\b[^"']*["'][\s\S]*?<\/a>/i, " "))
  return { title: catchline ? catchline.replace(/\.$/, "") : null, text: words || null }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
