// Nebraska — the Revised Statutes, from the Revisor of Statutes.
//
// `nebraskalegislature.gov/laws/display-chapters.php?chapter=1` is a whole
// chapter with its text: the section's number on one line, its catchline on
// the next, then the law, then the Source line the Revisor prints under it.
// `browse-statutes.php` names every chapter.
//
// A law here is a chapter, which is what Nebraska cites: "Neb. Rev. Stat.
// § 1-101" is section 101 of chapter 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://nebraskalegislature.gov/laws"

export default {
  id: "ne-revisor",
  name: "Nebraska Revisor of Statutes — the Revised Statutes of Nebraska",
  states: ["NE"],
  source: "https://nebraskalegislature.gov/laws/browse-statutes.php",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/browse-statutes.php`)
    const chapters = []
    for (const a of elements(index, "a")) {
      const number = /browse-chapters\.php\?chapter=([0-9A-Za-z]+)$/.exec(attrs(a.head).href ?? "")?.[1]
      if (!number || chapters.some((c) => c.number === number)) continue
      const label = line(a.inner).replace(/\s+/g, " ").trim()
      chapters.push({ number, name: titleCase(label.replace(/^Chapter\s+[0-9A-Za-z]+\s*[.:-]?\s*/i, "")) || null })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0
    const documents = await map(wanted, 8, async (c) => {
      const html = await fetchDoc(state, `${BASE}/display-chapters.php?chapter=${c.number}`, { notFound: null })
      at += 1
      if (at % 20 === 0) log(`${at}/${wanted.length} chapters fetched`)
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
        { location_id: "CHAPTER", doc_type: "CHAPTER", doc_level_id: chapter.number, title: chapter.name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["CHAPTER"])
      for (const section of readChapter(text(html), chapter.number)) {
        const location_id = unique(section.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: section.number,
          title: section.title,
          parent_location_id: "CHAPTER",
          depth: 1,
          repealed: /\brepealed\b/i.test(section.title ?? ""),
          text: section.text,
        })
      }
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

/** A chapter page: "1-105." then "Act, how cited." then the law. */
function* readChapter(whole, number) {
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const opens = new RegExp(`^${escaped}-[0-9A-Za-z,.]+\\.$`)
  const parts = whole.split(new RegExp(`(?=^${escaped}-[0-9A-Za-z,.]+\\.$)`, "m"))
  for (const part of parts) {
    const lines = part.split("\n")
    if (!opens.test((lines[0] ?? "").trim())) continue
    const cite = lines[0].trim().replace(/\.$/, "")
    const heading = lines.slice(1).find((l) => l.trim())
    yield {
      number: cite,
      title: titleCase((heading ?? "").trim().replace(/\.$/, "")) || null,
      text: part.trim() || null,
    }
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
