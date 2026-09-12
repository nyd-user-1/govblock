// Alaska — the Alaska Statutes, from the Legislative Affairs Agency.
//
// `akleg.gov/basis/statutes.asp` draws itself with JavaScript, and the two
// calls it makes are the whole of the state:
//
//   ?media=js&type=TOC&title=1        the chapters of title 1
//   ?media=js&type=TOC&title=01.05    the sections of chapter 01.05
//   ?media=print&type=fetch&secStart=01.05&secEnd=01.05
//                                     the law, as a window of the statutes
//                                     beginning at that chapter
//
// The print view is a scrolling window rather than a document: it starts where
// it is asked to and runs on past the end of the chapter into the next. So a
// chapter is read by asking for its start and keeping the sections that belong
// to it, and asking again from the last one if the window ended inside it.
//
// A law here is a chapter, which is what Alaska cites: "AS 01.05.006" is
// section 006 of chapter 05 of title 01.
import { fetchDoc } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.akleg.gov/basis/statutes.asp"
const TOC = (t) => `${BASE}?media=js&type=TOC&title=${t}`
const PRINT = (from) => `${BASE}?media=print&type=fetch&secStart=${from}&secEnd=${from}`

export default {
  id: "ak-laa",
  name: "Alaska Legislative Affairs Agency — the Alaska Statutes",
  states: ["AK"],
  source: "https://www.akleg.gov/basis/statutes.asp",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}`)
    const titles = [...new Set([...index.matchAll(/loadTOC\(\s*(\d+)\s*\)/g)].map((m) => m[1]))]
    log(`${titles.length} titles`)

    for (const t of titles) {
      const contents = await fetchDoc(state, TOC(t), { notFound: null })
      if (!contents) continue
      const titleName = titleCase((/Title\s+\d+\.\s*([^<]*)/.exec(contents)?.[1] ?? "").replace(/\s+/g, " ").trim().replace(/\.$/, ""))
      const chapters = []
      for (const m of contents.matchAll(/loadTOC\("(\d+\.\d+)"\);[^>]*>\s*(?:<b>)?Chapter\s+([0-9A-Za-z]+)\.\s*([^<]*)/g)) {
        if (chapters.some((c) => c.cite === m[1])) continue
        chapters.push({ cite: m[1], number: m[2], name: titleCase(m[3].replace(/\s+/g, " ").trim().replace(/\.$/, "")) })
      }

      for (const chapter of chapters) {
        const law_id = `C${chapter.cite}`
        if (only && law_id !== only.toUpperCase()) continue
        if (have?.has(law_id)) continue

        const sections = await readChapter(state, chapter.cite)
        if (!sections.length) {
          log(`· ${law_id} — the print view carries no section`)
          continue
        }
        const nodes = [
          {
            location_id: "CHAPTER",
            doc_type: "CHAPTER",
            doc_level_id: chapter.cite,
            title: [chapter.name, titleName].filter(Boolean).join(" — ") || null,
            parent_location_id: null,
            depth: 0,
          },
        ]
        const seen = new Set(["CHAPTER"])
        for (const section of sections) {
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
        log(`${law_id} · ${sections.length} sections · ${chapter.name}`)
        yield {
          law_id,
          law_name: chapter.name || `Chapter ${chapter.cite}`,
          law_type: "CONSOLIDATED",
          chapter: chapter.cite,
          nodes: inOrder(nodes),
        }
      }
    }
  },
}

/**
 * One chapter's sections, following the print view's window until it stops
 * returning sections that belong to the chapter.
 */
async function readChapter(state, cite) {
  const out = []
  let from = cite
  for (let round = 0; round < 12; round++) {
    const html = await fetchDoc(state, PRINT(from), { notFound: null })
    if (!html) break
    const parsed = readWindow(text(html), cite)
    const before = out.length
    for (const section of parsed) if (!out.some((s) => s.number === section.number)) out.push(section)
    if (out.length === before) break
    const last = out[out.length - 1].number
    // The window ran past the chapter, so everything in it has been seen.
    if (!parsed.length || parsed[parsed.length - 1].number !== last) break
    from = last
  }
  return out
}

/** The sections of one chapter inside a window of the statutes. */
function readWindow(whole, cite) {
  const opens = /(?=^Sec\.\s+\d+\.\d+\.\d+)/gm
  const parts = whole.split(opens)
  const out = []
  for (const part of parts) {
    const m = /^Sec\.\s+(\d+\.\d+\.\d+)\.\s*(.*)$/s.exec(part.trim())
    if (!m) continue
    if (!m[1].startsWith(cite + ".")) continue
    const rest = m[2].replace(/\s+/g, " ").trim()
    const cut = /^(.{2,200}?\.)\s+(?=\S)/.exec(rest)
    out.push({
      number: m[1],
      title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
      text: part.trim() || null,
    })
  }
  return out
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
