// New Hampshire — the Revised Statutes Annotated, from the General Court.
//
// `gencourt.state.nh.us/rsa/html/` is a plain file tree with an index at every
// level — `nhtoc.htm` names the titles, `NHTOC/NHTOC-I.htm` the chapters of
// title I, and each chapter has a merged file, `I/1/1-mrg.htm`, that is the
// whole of it: every section, its catchline, the law, and the Source line the
// General Court prints under it.
//
// A law here is a chapter, which is what New Hampshire cites: "RSA 1:1" is
// section 1 of chapter 1. The title is named on the chapter.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.gencourt.state.nh.us/rsa/html"

export default {
  id: "nh-gencourt",
  name: "New Hampshire General Court — the Revised Statutes Annotated",
  states: ["NH"],
  source: "https://www.gencourt.state.nh.us/rsa/html/nhtoc.htm",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/nhtoc.htm`)
    const titles = [
      ...new Set([...elements(index, "a")].map((a) => /NHTOC\/NHTOC-([IVXLC]+)\.htm$/i.exec(attrs(a.head).href ?? "")?.[1]).filter(Boolean)),
    ]
    log(`${titles.length} titles`)

    const chapters = []
    for (const t of titles) {
      const contents = await fetchDoc(state, `${BASE}/NHTOC/NHTOC-${t}.htm`, { notFound: null })
      if (!contents) continue
      const titleName = headingAfter(text(contents), new RegExp(`^TITLE\\s+${t}$`, "i"))
      for (const a of elements(contents, "a")) {
        const m = new RegExp(`^NHTOC-${t}-([0-9A-Za-z-]+)\\.htm$`, "i").exec(attrs(a.head).href ?? "")
        if (!m || chapters.some((c) => c.title === t && c.number === m[1])) continue
        chapters.push({ title: t, titleName, number: m[1] })
      }
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter(
      (c) => (!only || `T${c.title}C${c.number}` === only.toUpperCase()) && !have?.has(`T${c.title}C${c.number}`)
    )
    let at = 0
    const documents = await map(wanted, 10, async (c) => {
      const html = await fetchDoc(state, `${BASE}/${c.title}/${c.number}/${c.number}-mrg.htm`, { notFound: null })
      at += 1
      if (at % 100 === 0) log(`${at}/${wanted.length} chapters fetched`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const chapter = wanted[i]
      const html = documents[i]
      if (!html) continue
      const whole = text(html)
      const chapterName = headingAfter(whole, new RegExp(`^Chapter\\s+${chapter.number.replace("-", "-")}$`, "i"))
      const nodes = [
        {
          location_id: "CHAPTER",
          doc_type: "CHAPTER",
          doc_level_id: chapter.number,
          title: [chapterName, chapter.titleName].filter(Boolean).join(" — ") || null,
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["CHAPTER"])
      for (const section of readChapter(whole)) {
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
      if (nodes.length < 2) continue

      log(`T${chapter.title}C${chapter.number} · ${nodes.length - 1} sections · ${chapterName}`)
      yield {
        law_id: `T${chapter.title}C${chapter.number}`,
        law_name: chapterName || `Chapter ${chapter.number}`,
        law_type: "CONSOLIDATED",
        chapter: chapter.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

/** The line under a heading — "TITLE I" then "THE STATE AND ITS GOVERNMENT". */
function headingAfter(whole, match) {
  const lines = whole.split("\n").map((l) => l.trim())
  const at = lines.findIndex((l) => match.test(l))
  if (at < 0) return null
  for (let i = at + 1; i < lines.length; i++) if (lines[i]) return titleCase(lines[i]) || null
  return null
}

/**
 * A merged chapter: the General Court sets "Section 1:1" as a marker, then the
 * section's number and catchline, then the law, then its Source line.
 */
function* readChapter(whole) {
  const parts = whole.split(/(?=^Section\s+[0-9A-Za-z:-]+\s*$)/m)
  for (const part of parts.slice(1)) {
    const lines = part.split("\n").map((l) => l.trim())
    const number = /^Section\s+([0-9A-Za-z:-]+)$/.exec(lines[0])?.[1]
    if (!number) continue
    const heading = lines.find((l, i) => i > 0 && l && l.startsWith(number))
    const rest = heading ? heading.slice(number.length).trim() : ""
    yield {
      number,
      title: titleCase(rest.replace(/\.$/, "")) || null,
      text: part.split("\n").slice(1).join("\n").trim() || null,
    }
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
