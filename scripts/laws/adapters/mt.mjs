// Montana — the Montana Code Annotated, from the Legislative Services Division.
//
// `archive.legmt.gov/bills/mca/` is a tree of index pages four deep — titles,
// chapters, parts, sections — and one file per section. The section page
// prints the arrangement above it and then the law, and ends with the
// Division's disclaimer, which is where the law stops.
//
// The Code is called Annotated because the printed edition carries annotations
// the Division licenses; what the Division serves here is the statute and its
// enacting history, which is what is taken.
//
// A law here is a chapter, which is what Montana cites: "MCA § 1-1-101" is
// title 1, chapter 1, section 101. The parts are levels inside it.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://archive.legmt.gov/bills/mca"

// Where the Division stops printing the law and starts printing about it.
const FOOT = /^Disclaimer:/i

// The Division pads its directory names by ten so that a title numbered 17.5
// can sit between 17 and 18: `title_0010` is title 1, `title_0175` is 17.5.
const real = (padded) => String(Number(padded) / 10).replace(/\.0$/, "")

export default {
  id: "mt-lsd",
  name: "Montana Legislative Services Division — the Montana Code Annotated",
  states: ["MT"],
  source: "https://archive.legmt.gov/bills/mca/index.html",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/index.html`)
    const titles = [
      ...new Set([...elements(index, "a")].map((a) => /title_(\d+)\/chapters_index\.html$/.exec(attrs(a.head).href ?? "")?.[1]).filter(Boolean)),
    ]
    log(`${titles.length} titles`)

    for (const t of titles) {
      const contents = await fetchDoc(state, `${BASE}/title_${t}/chapters_index.html`, { notFound: null })
      if (!contents) continue
      const titleName = headingOf(text(contents), "TITLE")
      const chapters = [
        ...new Set([...elements(contents, "a")].map((a) => /chapter_(\d+)\/parts_index\.html$/.exec(attrs(a.head).href ?? "")?.[1]).filter(Boolean)),
      ]

      for (const c of chapters) {
        const law_id = `T${real(t)}C${real(c)}`
        if (only && law_id !== only.toUpperCase()) continue
        if (have?.has(law_id)) continue

        const partsPage = await fetchDoc(state, `${BASE}/title_${t}/chapter_${c}/parts_index.html`, { notFound: null })
        if (!partsPage) continue
        const chapterName = headingOf(text(partsPage), "CHAPTER")
        const parts = [
          ...new Set([...elements(partsPage, "a")].map((a) => /part_(\d+)\/sections_index\.html$/.exec(attrs(a.head).href ?? "")?.[1]).filter(Boolean)),
        ]
        if (!parts.length) continue

        const lists = await map(parts, 8, (p) => fetchDoc(state, `${BASE}/title_${t}/chapter_${c}/part_${p}/sections_index.html`, { notFound: null }))
        const plan = []
        for (let i = 0; i < parts.length; i++) {
          plan.push({ kind: "PART", number: real(parts[i]), name: headingOf(text(lists[i] ?? ""), "Part") })
          for (const a of elements(lists[i] ?? "", "a")) {
            const m = /section_(\d+)\/([\d-]+)\.html$/.exec(attrs(a.head).href ?? "")
            if (!m || plan.some((p) => p.file === m[2])) continue
            plan.push({ kind: "SECTION", part: parts[i], section: m[1], file: m[2] })
          }
        }
        const sections = plan.filter((p) => p.kind === "SECTION")
        if (!sections.length) continue

        const bodies = await map(sections, 10, (s) =>
          fetchDoc(state, `${BASE}/title_${t}/chapter_${c}/part_${s.part}/section_${s.section}/${s.file}.html`, { notFound: null })
        )

        const nodes = [
          {
            location_id: "CHAPTER",
            doc_type: "CHAPTER",
            doc_level_id: real(c),
            title: [chapterName, titleName].filter(Boolean).join(" — ") || null,
            parent_location_id: null,
            depth: 0,
          },
        ]
        const seen = new Set(["CHAPTER"])
        let parent = "CHAPTER"
        let read = 0
        for (const item of plan) {
          if (item.kind === "PART") {
            const location_id = unique(`p${item.number}`, seen)
            seen.add(location_id)
            nodes.push({ location_id, doc_type: "PART", doc_level_id: item.number, title: item.name, parent_location_id: "CHAPTER", depth: 1 })
            parent = location_id
            continue
          }
          const body = bodies[read++]
          const found = body ? readSection(body) : null
          const number = found?.number ?? item.file.split("-").map((x) => String(Number(x))).join("-")
          const location_id = unique(number, seen)
          seen.add(location_id)
          nodes.push({
            location_id,
            doc_type: "SECTION",
            doc_level_id: number,
            title: found?.title ?? null,
            parent_location_id: parent,
            depth: 2,
            repealed: /\brepealed\b/i.test(found?.title ?? ""),
            text: found?.text ?? null,
          })
        }
        if (!nodes.some((n) => n.text)) continue

        log(`${law_id} · ${sections.length} sections · ${chapterName}`)
        yield {
          law_id,
          law_name: chapterName || `Chapter ${real(c)}`,
          law_type: "CONSOLIDATED",
          chapter: real(c),
          nodes: inOrder(nodes),
        }
      }
    }
  },
}

/** "TITLE 1. GENERAL LAWS AND DEFINITIONS" — the name after the number. */
function headingOf(whole, kind) {
  const at = whole.split("\n").map((l) => l.trim()).find((l) => new RegExp(`^${kind}\\s+[0-9A-Za-z]+\\.\\s+\\S`).test(l))
  if (!at) return null
  return titleCase(at.replace(new RegExp(`^${kind}\\s+[0-9A-Za-z]+\\.\\s*`), "").replace(/\.$/, "")) || null
}

/** A section page: the law between its own number and the Division's disclaimer. */
function readSection(html) {
  const lines = text(html).split("\n")
  const at = lines.findIndex((l) => /^\d+-\d+-\d+\.\s+\S/.test(l.trim()))
  if (at < 0) return null
  const end = lines.findIndex((l, i) => i > at && FOOT.test(l.trim()))
  const m = /^(\d+-\d+-\d+)\.\s+(.*)$/s.exec(lines[at].trim())
  const rest = m ? m[2] : ""
  const cut = /^(.{2,160}?\.)\s+(?=\S)/.exec(rest)
  return {
    number: m ? m[1] : null,
    title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
    text: lines.slice(at, end < 0 ? undefined : end).join("\n").trim() || null,
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
