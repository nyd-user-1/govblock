// Vermont — the Vermont Statutes Annotated, from the Office of Legislative
// Counsel.
//
// `legislature.vermont.gov/statutes` is three levels of page: the index names
// the titles, a title names its chapters, a chapter names its subchapters and
// its sections, and a section page carries the law. Vermont is small enough
// that a page per section is a few thousand requests rather than a night.
//
// The annotations the title's name refers to are the publisher's; what the
// section page carries is the text and the acts that made it, which is what
// is taken.
//
// A law here is a chapter, which is the unit Vermont cites: "1 V.S.A. § 51" is
// section 51, in title 1, chapter 1. The title is named on the chapter.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://legislature.vermont.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

/** "Title <span>01</span> : <span>General Provisions</span>" — number, then name. */
function designation(html) {
  const flat = line(html).replace(/\s+/g, " ").trim()
  const m = /^(Title|Chapter|Subchapter|Part|Article)\s+([0-9A-Za-z]+)\s*:\s*(.*)$/i.exec(flat)
  return m ? { kind: m[1].toUpperCase(), number: m[2], name: titleCase(m[3]) } : null
}

export default {
  id: "vt-legislature",
  name: "Vermont Office of Legislative Counsel — the Vermont Statutes",
  states: ["VT"],
  source: "https://legislature.vermont.gov/statutes/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/statutes/`)
    // The first three titles are linked relatively and one of them is an
    // appendix, so the slug is taken whole rather than as digits and a letter —
    // "03APPENDIX" is a title of its own, not title 3 read badly.
    const titles = [...new Set([...index.matchAll(/\/?statutes\/title\/([0-9A-Za-z]+)/g)].map((m) => m[1]))]
    log(`${titles.length} titles`)

    // Every chapter of every title, with the title it sits in, in the order
    // the Office prints them.
    const chapters = []
    for (const t of titles) {
      const page = await fetchDoc(state, `${BASE}/statutes/title/${t}`, { notFound: null })
      if (!page) {
        log(`✗ title ${t} — no page`)
        continue
      }
      const titleName = [...elements(page, "h2", cls("statute-title"))].map((h) => designation(h.inner)).find(Boolean)?.name ?? null
      for (const m of [...page.matchAll(/\/?statutes\/chapter\/([0-9A-Za-z]+)\/([0-9A-Za-z]+)/g)]) {
        if (m[1] !== t || chapters.some((c) => c.title === t && c.number === m[2])) continue
        chapters.push({ title: t, titleName, number: m[2] })
      }
    }
    log(`${chapters.length} chapters`)

    for (const chapter of chapters) {
      const law_id = `T${chapter.title}C${chapter.number}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const page = await fetchDoc(state, `${BASE}/statutes/chapter/${chapter.title}/${chapter.number}`, { notFound: null })
      if (!page) {
        log(`✗ ${law_id} — no chapter page`)
        continue
      }
      const own = [...elements(page, "h3", cls("statute-chapter"))].map((h) => designation(h.inner)).find(Boolean)
      const law_name = own?.name || `Chapter ${chapter.number}`

      const nodes = [
        {
          location_id: "CHAPTER",
          doc_type: "CHAPTER",
          doc_level_id: String(Number(chapter.number)),
          title: [law_name, chapter.titleName].filter(Boolean).join(" — "),
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["CHAPTER"])
      // The chapter page lists its subchapters and, under each, its sections;
      // the order of both is the order of the list.
      const plan = readContents(page)
      const bodies = await map(
        plan.filter((p) => p.kind === "SECTION"),
        10,
        (p) => fetchDoc(state, `${BASE}${p.href}`, { notFound: null })
      )

      let parent = "CHAPTER"
      let at = 0
      for (const item of plan) {
        if (item.kind !== "SECTION") {
          const location_id = unique(`sub-${item.number}`, seen)
          seen.add(location_id)
          nodes.push({
            location_id,
            doc_type: item.doc_type,
            doc_level_id: String(Number(item.number)),
            title: item.name,
            parent_location_id: "CHAPTER",
            depth: 1,
          })
          parent = location_id
          continue
        }
        const html = bodies[at++]
        const location_id = unique(item.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: item.number,
          title: item.name,
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(item.label),
          text: html ? readSection(html) || item.label : item.label,
        })
      }

      if (!nodes.some((n) => n.doc_type === "SECTION")) {
        log(`· ${law_id} — the chapter lists no section`)
        continue
      }
      log(`${law_id} · ${nodes.filter((n) => n.doc_type === "SECTION").length} sections · ${law_name}`)
      yield { law_id, law_name, law_type: "CONSOLIDATED", chapter: chapter.number, nodes: inOrder(nodes) }
    }
  },
}

/** A chapter page's subchapter headings and section links, in printed order. */
function readContents(page) {
  const out = []
  for (const li of elements(page, "li")) {
    const strong = [...elements(li.inner, "strong")][0]
    if (strong) {
      const heading = designation(strong.inner)
      if (heading && heading.kind !== "TITLE" && heading.kind !== "CHAPTER") {
        out.push({ kind: "LEVEL", doc_type: heading.kind, number: heading.number, name: heading.name })
      }
      continue
    }
    const a = [...elements(li.inner, "a")][0]
    if (!a) continue
    const href = /href="([^"]*\/statutes\/section\/[^"]+)"/.exec(a.head)?.[1]
    if (!href) continue
    const label = line(a.inner).replace(/\s+/g, " ").trim()
    // "§ 51. Vermont Statutes Annotated defined" — and, for a run the Office
    // repealed at once, "§§ Sections 53, 54. Repealed. 2013, No. 34, § 31."
    const m = /^§+\s*(?:Sections?\s+)?([0-9A-Za-z][0-9A-Za-z,.\s-]*?)\.\s*(.*)$/s.exec(label)
    if (!m) continue
    out.push({
      kind: "SECTION",
      href,
      number: m[1].replace(/\s+/g, " ").trim(),
      name: titleCase(m[2].replace(/\.$/, "")) || null,
      label,
    })
  }
  return out
}

/** A section page: the law, and the acts the Office prints in parentheses after it. */
function readSection(html) {
  const list = [...elements(html, "ul", cls("statutes-detail"))][0]
  if (!list) return null
  return text(list.inner) || null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
