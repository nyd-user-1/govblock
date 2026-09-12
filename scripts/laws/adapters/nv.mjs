// Nevada — the Nevada Revised Statutes, from the Legislative Counsel Bureau.
//
// `leg.state.nv.us/NRS/NRS-001.html` is a whole chapter in one file, published
// out of a word processor and served as windows-1252. The chapter's own table
// of contents comes first, then the law: a section opens on "NRS 1.010" and
// its catchline and runs, one paragraph per subsection, to the next one, with
// the Bureau's source note in brackets at the end.
//
// Between sections the Bureau sets centred headings in capitals — "GENERAL
// PROVISIONS" — which are the chapter's own divisions.
//
// A law here is a chapter, which is what Nevada cites: "NRS 1.010" is section
// 010 of chapter 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.leg.state.nv.us/NRS"

// "NRS 1.010 Courts of justice. The following shall be…" — the number, the
// catchline, and the law behind it on the same line.
const OPENS = /^NRS\s+([0-9A-Za-z]+\.[0-9A-Za-z]+)\s+(.*)$/s

export default {
  id: "nv-lcb",
  name: "Nevada Legislative Counsel Bureau — the Nevada Revised Statutes",
  states: ["NV"],
  source: "https://www.leg.state.nv.us/NRS/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/`)
    const chapters = []
    for (const a of elements(index, "a")) {
      const m = /NRS-([0-9A-Za-z]+)\.html/i.exec(attrs(a.head).href ?? "")
      if (!m || chapters.some((c) => c.slug === m[1])) continue
      chapters.push({ slug: m[1], number: String(m[1]).replace(/^0+/, "") || m[1] })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0
    const documents = await map(wanted, 8, async (c) => {
      const html = await fetchDoc(state, `${BASE}/NRS-${c.slug}.html`, { notFound: null })
      at += 1
      if (at % 100 === 0) log(`${at}/${wanted.length} chapters fetched`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const chapter = wanted[i]
      const html = documents[i]
      if (!html) continue
      const law = read(html, chapter.number)
      if (!law) {
        log(`· chapter ${chapter.number} — the file carries no section`)
        continue
      }
      log(`C${chapter.number} · ${law.nodes.filter((n) => n.doc_type === "SECTION").length} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(html, number) {
  const body = html.slice(html.search(/<body/i))
  const name = titleCase(
    (/<title>[^<]*CHAPTER\s+[0-9A-Za-z]+\s*[-–—]\s*([^<]*)<\/title>/i.exec(html)?.[1] ?? "").trim()
  )
  const paragraphs = []
  for (const p of elements(body, "p")) {
    const flat = line(p.inner).replace(/ /g, " ").trim()
    if (!flat) continue
    // The chapter's contents link forward into the page; the law itself is
    // anchored rather than linked, which is what separates the two halves of
    // the file without guessing at lengths.
    const contents = /<a[^>]+href\s*=\s*["']?#/i.test(p.inner)
    paragraphs.push({ flat, contents })
  }

  const start = paragraphs.findIndex((p) => !p.contents && OPENS.test(p.flat))
  if (start < 0) return null

  const nodes = [
    { location_id: "CHAPTER", doc_type: "CHAPTER", doc_level_id: number, title: name || `Chapter ${number}`, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["CHAPTER"])
  let parent = "CHAPTER"
  let open = null
  let lines = []

  const close = () => {
    if (!open) return
    nodes.push({
      location_id: open.location_id,
      doc_type: "SECTION",
      doc_level_id: open.number,
      title: open.title,
      parent_location_id: open.parent,
      depth: 0,
      repealed: /\brepealed\b/i.test(open.title ?? ""),
      text: [`NRS ${open.number} ${open.title ?? ""}`.trim(), ...lines].filter(Boolean).join("\n\n") || null,
    })
    open = null
    lines = []
  }

  for (const paragraph of paragraphs.slice(start)) {
    if (paragraph.contents) continue
    const flat = paragraph.flat
    if (/^_+$/.test(flat)) continue

    const m = OPENS.exec(flat)
    if (m) {
      close()
      const location_id = unique(m[1], seen)
      seen.add(location_id)
      const rest = m[2].replace(/\s+/g, " ").trim()
      const cut = /^(.{2,160}?\.)\s+(?=\S)/.exec(rest)
      open = {
        location_id,
        number: m[1],
        title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
        parent,
      }
      lines = cut ? [rest.slice(cut[0].length).trim()] : []
      continue
    }

    // A heading the Bureau sets in capitals between sections is a division of
    // the chapter, and the sections after it hang off it.
    if (!open && flat === flat.toUpperCase() && /[A-Z]/.test(flat) && flat.length < 120) {
      const location_id = unique(`h${seen.size}`, seen)
      seen.add(location_id)
      nodes.push({ location_id, doc_type: "PART", doc_level_id: "", title: titleCase(flat), parent_location_id: "CHAPTER", depth: 1 })
      parent = location_id
      continue
    }

    if (open) lines.push(flat)
  }
  close()

  if (!nodes.some((n) => n.doc_type === "SECTION")) return null
  return { law_id: `C${number}`, law_name: name || `Chapter ${number}`, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
