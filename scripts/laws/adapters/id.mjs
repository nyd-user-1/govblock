// Idaho — the Idaho Statutes, from the Legislative Services Office.
//
// `legislature.idaho.gov/statutesrules/idstat/` is three levels of page —
// titles, chapters, sections — served out of a WordPress theme that puts no
// class on the statute itself. So the section is cut out of the page's prose
// rather than out of its markup: it begins at the line the number opens and
// ends where the page's own furniture begins again.
//
// A law here is a chapter, which is what Idaho cites: "Idaho Code § 1-101" is
// section 101 of title 1, chapter 1. The title is named on the chapter.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://legislature.idaho.gov"

// Where the page stops being the law and starts being the site again.
const FURNITURE = /^(How current is this law\?|Who.s My Legislator\?|Print Friendly)$/i

export default {
  id: "id-lso",
  name: "Idaho Legislative Services Office — the Idaho Statutes",
  states: ["ID"],
  source: "https://legislature.idaho.gov/statutesrules/idstat/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/statutesrules/idstat/`)
    const titles = []
    for (const a of elements(index, "a")) {
      const m = /^\/statutesrules\/idstat\/(Title([0-9A-Za-z]+))\/?$/.exec(attrs(a.head).href ?? "")
      if (!m || titles.some((t) => t.slug === m[1])) continue
      titles.push({ slug: m[1], number: m[2], name: titleCase(line(a.inner).replace(/^Title\s+[0-9A-Za-z]+\s*[-–—]?\s*/i, "")) })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const contents = await fetchDoc(state, `${BASE}/statutesrules/idstat/${title.slug}/`, { notFound: null })
      if (!contents) {
        log(`✗ title ${title.number} — no contents page`)
        continue
      }
      const chapters = []
      for (const a of elements(contents, "a")) {
        const m = new RegExp(`^/statutesrules/idstat/${title.slug}/(T${title.number}CH([0-9A-Za-z]+))/?$`).exec(attrs(a.head).href ?? "")
        if (!m || chapters.some((c) => c.slug === m[1])) continue
        chapters.push({ slug: m[1], number: m[2], name: titleCase(line(a.inner).replace(/^Chapter\s+[0-9A-Za-z]+\s*[-–—]?\s*/i, "")) })
      }

      for (const chapter of chapters) {
        const law_id = `T${title.number}C${chapter.number}`
        if (only && law_id !== only.toUpperCase()) continue
        if (have?.has(law_id)) continue

        const page = await fetchDoc(state, `${BASE}/statutesrules/idstat/${title.slug}/${chapter.slug}/`, { notFound: null })
        if (!page) continue
        const listed = []
        for (const a of elements(page, "a")) {
          const m = new RegExp(`^/statutesrules/idstat/${title.slug}/${chapter.slug}/SECT([0-9A-Za-z.-]+)/?$`).exec(attrs(a.head).href ?? "")
          if (!m || listed.some((s) => s.number === m[1])) continue
          listed.push({ number: m[1], href: m[0] })
        }
        if (!listed.length) continue

        const bodies = await map(listed, 10, (s) => fetchDoc(state, `${BASE}${s.href}/`, { notFound: null }))

        const nodes = [
          {
            location_id: "CHAPTER",
            doc_type: "CHAPTER",
            doc_level_id: chapter.number,
            title: [chapter.name, title.name].filter(Boolean).join(" — "),
            parent_location_id: null,
            depth: 0,
          },
        ]
        const seen = new Set(["CHAPTER"])
        for (let i = 0; i < listed.length; i++) {
          const read = bodies[i] ? readSection(bodies[i], listed[i].number) : null
          const location_id = unique(listed[i].number, seen)
          seen.add(location_id)
          nodes.push({
            location_id,
            doc_type: "SECTION",
            doc_level_id: listed[i].number,
            title: read?.title ?? null,
            parent_location_id: "CHAPTER",
            depth: 1,
            repealed: /\brepealed\b/i.test(read?.title ?? ""),
            text: read?.text ?? null,
          })
        }
        if (!nodes.some((n) => n.text)) continue

        log(`${law_id} · ${listed.length} sections · ${chapter.name}`)
        yield {
          law_id,
          law_name: chapter.name || `Chapter ${chapter.number}`,
          law_type: "CONSOLIDATED",
          chapter: chapter.number,
          nodes: inOrder(nodes),
        }
      }
    }
  },
}

/**
 * One section page, cut out of the page's prose.
 *
 * The law begins on the line that opens with the section's own number and runs
 * until the page starts speaking for itself again.
 */
function readSection(html, number) {
  const lines = text(html).split("\n")
  const at = lines.findIndex((l) => new RegExp(`^${number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\s`).test(l.trim()))
  if (at < 0) return null
  const end = lines.findIndex((l, i) => i > at && FURNITURE.test(l.trim()))
  const body = lines.slice(at, end < 0 ? undefined : end).join("\n").trim()
  const first = lines[at].trim().slice(number.length + 1).trim()
  const cut = /^(.{2,160}?\.)\s+(?=\S)/.exec(first)
  return { title: titleCase((cut ? cut[1] : first).replace(/\.$/, "")) || null, text: body || null }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
