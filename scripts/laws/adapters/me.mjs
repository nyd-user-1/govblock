// Maine — the Maine Revised Statutes, from the Revisor of Statutes.
//
// `legislature.maine.gov/legis/statutes/` is a plain tree of files: a title's
// contents, a chapter's contents at `title1ch1sec0.html`, and a section at
// `title1sec1.html`. The pages are generated from the Revisor's XML and carry
// the same furniture on every one — the site's own menu — so a section is cut
// out of the page's prose where its number opens and runs to the Revisor's
// note at the foot.
//
// A law here is a title, which is how Maine cites: "1 M.R.S. § 1" is section 1
// of title 1. The chapters are levels inside it.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://legislature.maine.gov/legis/statutes"

// Where the Revisor stops printing the law and starts printing about it.
const FOOT = /^(The Revisor's Office cannot provide legal advice|Office of the Revisor of Statutes|Data for this page|Maine Law & Disclaimer)/i

export default {
  id: "me-revisor",
  name: "Maine Revisor of Statutes — the Maine Revised Statutes",
  states: ["ME"],
  source: "https://legislature.maine.gov/legis/statutes/",

  async *laws({ state, only, have, log }) {
    // The Revisor's index is a frame of links; the titles are numbered 1 to 39
    // with lettered ones beside them, and a number Maine does not use answers
    // with a page that names no chapter.
    const titles = []
    for (let n = 1; n <= 39; n++) for (const letter of ["", "A", "B", "C"]) titles.push(`${n}${letter}`)

    for (const t of titles) {
      const law_id = `T${t}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const contents = await fetchDoc(state, `${BASE}/${t}/title${t}ch0sec0.html`, { notFound: null })
      if (!contents) continue
      const chapters = []
      for (const a of elements(contents, "a")) {
        const m = new RegExp(`title${t}ch([0-9A-Za-z-]+)sec0\\.html$`).exec(attrs(a.head).href ?? "")
        if (!m || chapters.some((c) => c.number === m[1])) continue
        chapters.push({ number: m[1], name: titleCase(line(a.inner).replace(/^Chapter\s+[0-9A-Za-z-]+:?\s*/i, "")) })
      }
      if (!chapters.length) continue

      const lists = await map(chapters, 10, (c) => fetchDoc(state, `${BASE}/${t}/title${t}ch${c.number}sec0.html`, { notFound: null }))
      const plan = []
      for (let i = 0; i < chapters.length; i++) {
        plan.push({ kind: "CHAPTER", ...chapters[i] })
        for (const a of elements(lists[i] ?? "", "a")) {
          const m = new RegExp(`title${t}sec([0-9A-Za-z.-]+)\\.html$`).exec(attrs(a.head).href ?? "")
          if (!m || plan.some((p) => p.kind === "SECTION" && p.number === m[1])) continue
          plan.push({ kind: "SECTION", number: m[1], name: titleCase(line(a.inner).replace(/^[0-9A-Za-z]+\s*§[0-9A-Za-z.-]+\.?\s*/i, "")) })
        }
      }
      const sections = plan.filter((p) => p.kind === "SECTION")
      if (!sections.length) continue

      const bodies = await map(sections, 12, (s) => fetchDoc(state, `${BASE}/${t}/title${t}sec${s.number}.html`, { notFound: null }))

      const titleName = titleCase(
        (/Title\s+[0-9A-Za-z]+:\s*([^\n]+)/.exec(text(lists.find(Boolean) ?? contents))?.[1] ?? "").trim()
      )
      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: t, title: titleName || `Title ${t}`, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      let parent = "TITLE"
      let read = 0

      for (const item of plan) {
        if (item.kind === "CHAPTER") {
          const location_id = unique(`ch${item.number}`, seen)
          seen.add(location_id)
          nodes.push({ location_id, doc_type: "CHAPTER", doc_level_id: item.number, title: item.name, parent_location_id: "TITLE", depth: 1 })
          parent = location_id
          continue
        }
        const html = bodies[read++]
        const location_id = unique(item.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: item.number,
          title: item.name,
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(item.name ?? ""),
          text: (html ? readSection(html, item.number) : null) ?? `§${item.number}. ${item.name ?? ""}`.trim(),
        })
      }

      log(`${law_id} · ${chapters.length} chapters · ${sections.length} sections · ${titleName}`)
      yield { law_id, law_name: titleName || `Title ${t}`, law_type: "CONSOLIDATED", chapter: t, nodes: inOrder(nodes) }
    }
  },
}

/** One section page: the law between its own heading and the Revisor's foot. */
function readSection(html, number) {
  const lines = text(html).split("\n")
  const at = lines.findIndex((l) => new RegExp(`^§${number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`).test(l.trim()))
  if (at < 0) return null
  const end = lines.findIndex((l, i) => i > at && FOOT.test(l.trim()))
  return lines.slice(at, end < 0 ? undefined : end).join("\n").trim() || null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
