// Rhode Island — the General Laws, from the General Assembly.
//
// `webserver.rilegislature.gov/Statutes/` is a plain tree of files: an index of
// titles, a title's index of chapters, a chapter's index of sections, and one
// file per section carrying the title and chapter it sits under, the citation,
// the law, and the history the Assembly prints beneath it.
//
// A law here is a chapter, which is what Rhode Island cites: "R.I. Gen. Laws
// § 1-1-1" is title 1, chapter 1, section 1. The title is named on the chapter.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://webserver.rilegislature.gov/Statutes"

export default {
  id: "ri-legislature",
  name: "Rhode Island General Assembly — the General Laws",
  states: ["RI"],
  source: "https://webserver.rilegislature.gov/Statutes/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/`)
    const titles = [
      ...new Set([...elements(index, "a")].map((a) => /^(?:\.\/)?TITLE([0-9A-Za-z.-]+)\/?/i.exec(attrs(a.head).href ?? "")?.[1]).filter(Boolean)),
    ]
    log(`${titles.length} titles`)

    for (const t of titles) {
      const contents = await fetchDoc(state, `${BASE}/TITLE${t}/INDEX.HTM`, { notFound: null })
      if (!contents) continue
      const titleName = nameOf(text(contents), "Title")
      const chapters = [
        ...new Set(
          [...elements(contents, "a")].map((a) => /^([0-9A-Za-z.-]+)\/INDEX\.htm$/i.exec(attrs(a.head).href ?? "")?.[1]).filter(Boolean)
        ),
      ]

      for (const chapter of chapters) {
        const law_id = `C${chapter}`
        if (only && law_id !== only.toUpperCase()) continue
        if (have?.has(law_id)) continue

        const page = await fetchDoc(state, `${BASE}/TITLE${t}/${chapter}/INDEX.htm`, { notFound: null })
        if (!page) continue
        const listed = [
          ...new Set(
            [...elements(page, "a")].map((a) => /^([0-9A-Za-z.-]+)\.htm$/i.exec(attrs(a.head).href ?? "")?.[1]).filter(Boolean)
          ),
        ].filter((n) => n.toUpperCase() !== "INDEX")
        if (!listed.length) continue

        const chapterName = nameOf(text(page), "Chapter")
        const bodies = await map(listed, 10, (n) => fetchDoc(state, `${BASE}/TITLE${t}/${chapter}/${n}.htm`, { notFound: null }))

        const nodes = [
          {
            location_id: "CHAPTER",
            doc_type: "CHAPTER",
            doc_level_id: chapter,
            title: [chapterName, titleName].filter(Boolean).join(" — ") || null,
            parent_location_id: null,
            depth: 0,
          },
        ]
        const seen = new Set(["CHAPTER"])
        for (let i = 0; i < listed.length; i++) {
          const read = bodies[i] ? readSection(bodies[i], listed[i]) : null
          const location_id = unique(listed[i], seen)
          seen.add(location_id)
          nodes.push({
            location_id,
            doc_type: "SECTION",
            doc_level_id: listed[i],
            title: read?.title ?? null,
            parent_location_id: "CHAPTER",
            depth: 1,
            repealed: /\brepealed\b/i.test(read?.title ?? ""),
            text: read?.text ?? null,
          })
        }
        if (!nodes.some((n) => n.text)) continue

        log(`${law_id} · ${listed.length} sections · ${chapterName}`)
        yield {
          law_id,
          law_name: chapterName || `Chapter ${chapter}`,
          law_type: "CONSOLIDATED",
          chapter,
          nodes: inOrder(nodes),
        }
      }
    }
  },
}

/** "Title 1" then "Aeronautics" on the line under it — the heading's own name. */
function nameOf(whole, kind) {
  const lines = whole.split("\n").map((l) => l.trim())
  const at = lines.findIndex((l) => new RegExp(`^${kind}\\s+[0-9A-Za-z.-]+$`, "i").test(l))
  if (at < 0) return null
  return titleCase((lines[at + 1] ?? "").replace(/\s*\[Repealed\.?\]\s*$/i, "").trim()) || null
}

/** One section file: its catchline and the law, without the headings above it. */
function readSection(html, number) {
  const lines = text(html).split("\n")
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const at = lines.findIndex((l) => new RegExp(`^§\\s*${escaped}\\.`).test(l.trim()))
  if (at < 0) return null
  const heading = lines[at].trim().replace(new RegExp(`^§\\s*${escaped}\\.\\s*`), "")
  return {
    title: titleCase(heading.replace(/\.$/, "")) || null,
    text: lines.slice(at).join("\n").trim() || null,
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
