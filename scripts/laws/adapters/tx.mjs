// Texas — the codes and the Constitution, from the Legislative Council.
//
// `statutes.capitol.texas.gov` was rebuilt as an Angular application and every
// old path answers with the 250 KB shell, which is why this state sat open.
// The documents did not go anywhere: the application reads them from a file
// server of its own, named in its bundle —
//
//   environment = { TCASCore: "https://tcss.legis.texas.gov/api/",
//                   FileServerPath: "https://tcss.legis.texas.gov/resources" }
//
// and the files there are the same per-chapter HTML the site served before,
// at `/<CODE>/htm/<CODE>.<chapter>.htm`. So Texas is a bulk state after all:
// one API call per code hands back its whole title/subtitle/chapter tree with
// the `htmLink` of every chapter on it, and one file per chapter carries every
// section's words. Thirty-one calls and about four thousand documents for the
// largest body of state law in the country.
//
// A law here is a code, which is the unit Texas cites: "Tex. Bus. & Com. Code
// § 1.001". The titles, subtitles and chapters are levels inside it.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const API = "https://tcss.legis.texas.gov/api"
const FILES = "https://tcss.legis.texas.gov/resources"

// "TITLE 1. GENERAL PROVISIONS" — the kind, the number, the name.
const KINDS = {
  TITLE: "TITLE",
  SUBTITLE: "SUBTITLE",
  CHAPTER: "CHAPTER",
  SUBCHAPTER: "SUBCHAPTER",
  ARTICLE: "ARTICLE",
  PART: "PART",
  DIVISION: "DIVISION",
  SUBDIVISION: "SUBDIVISION",
  SUBPART: "SUBPART",
}

function readHeading(heading) {
  const clean = String(heading ?? "").replace(/\s+/g, " ").trim()
  const m = /^([A-Z]+)\s+([0-9A-Za-z.-]+?)\.?\s*[.:]\s*(.*)$/.exec(clean)
  if (m && KINDS[m[1]]) return { doc_type: KINDS[m[1]], doc_level_id: m[2], title: titleCase(m[3]) }
  const bare = /^([A-Z]+)\s+([0-9A-Za-z.-]+)\.?$/.exec(clean)
  if (bare && KINDS[bare[1]]) return { doc_type: KINDS[bare[1]], doc_level_id: bare[2], title: null }
  return { doc_type: "PART", doc_level_id: "", title: titleCase(clean) || null }
}

export default {
  id: "tx-tcss",
  name: "Texas Legislative Council — statutes file server (tcss.legis.texas.gov)",
  states: ["TX"],
  source: "https://statutes.capitol.texas.gov/",

  async *laws({ state, only, have, log }) {
    const codes = (await fetchDoc(state, `${API}/StatutesByDate/GetCodes/${today()}`, { json: true })).filter(
      (c) => c.code && c.codeID !== 99
    )
    log(`${codes.length} codes`)

    for (const code of codes) {
      const law_id = code.code
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      // One call, and the whole arrangement of the code comes back with the
      // address of every chapter document on it.
      const tree = await fetchDoc(
        state,
        `${API}/StatuteCode/GetTopLevelHeadings/${encodeURIComponent("/" + code.codeID)}/${law_id}/1/true/false`,
        { json: true }
      )

      const law_name = titleCase(String(code.codename).replace(/\s+Code$/i, "").trim())
      const nodes = [
        { location_id: "CODE", doc_type: "CODE", doc_level_id: law_id, title: `${law_name} Code`, parent_location_id: null, depth: 0 },
      ]
      const chapters = []
      const seen = new Set(["CODE"])

      // The tree's own order is the code's order, and a node's htmLink is the
      // document that holds its sections. A heading with no link is a level.
      const walk = (list, parent, depth) => {
        for (const node of list ?? []) {
          const { doc_type, doc_level_id, title } = readHeading(node.name)
          const location_id = `n${nodes.length}`
          nodes.push({ location_id, doc_type, doc_level_id, title, parent_location_id: parent, depth })
          seen.add(location_id)
          if (node.htmLink) chapters.push({ location_id, link: node.htmLink, depth })
          walk(node.children, location_id, depth + 1)
        }
      }
      walk(tree, "CODE", 1)

      if (!chapters.length) {
        log(`✗ ${law_id} — the tree names no chapter documents`)
        continue
      }

      let at = 0
      const documents = await map(chapters, 16, async (chapter) => {
        const html = await fetchDoc(state, FILES + chapter.link, { notFound: null })
        at += 1
        if (at % 200 === 0) log(`  ${law_id} ${at}/${chapters.length} chapters`)
        return html
      })

      let sections = 0
      for (let i = 0; i < chapters.length; i++) {
        const html = documents[i]
        if (!html) continue
        const chapter = chapters[i]
        // A chapter document repeats the headings above it before its first
        // section; those are already in the tree, so only the subchapters the
        // document introduces below the chapter are taken from it.
        for (const node of readChapter(html, chapter, seen)) {
          nodes.push(node)
          seen.add(node.location_id)
          if (node.doc_type === "SECTION") sections += 1
        }
      }

      log(`${law_id} · ${chapters.length} chapters · ${sections.toLocaleString("en-US")} sections`)
      yield { law_id, law_name, law_type: law_id === "CN" ? "MISC" : "CONSOLIDATED", chapter: null, nodes: inOrder(nodes) }
    }
  },
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * One chapter document: its subchapters, its sections, and each section's
 * words with the enacting history the Council prints under it.
 *
 * The Council sets a section as one paragraph that opens with a bold link —
 * "Sec. 1.001.  PURPOSE OF CODE." — followed by the first words of the law,
 * then a paragraph per subsection, then an unindented paragraph carrying the
 * acts that enacted and amended it. The bold centred paragraphs between
 * sections are the subchapter headings.
 */
function* readChapter(html, chapter, seen) {
  const body = html.slice(html.indexOf("<body"))
  const paragraphs = []
  for (const p of elements(body, "p")) {
    const head = attrs(p.head)
    paragraphs.push({
      html: p.inner,
      centred: (head.class ?? "").includes("center"),
      bold: /font-weight:\s*bold/i.test(head.style ?? "") || /font-weight:\s*bold/i.test(p.inner),
    })
  }

  let parent = chapter.location_id
  let depth = chapter.depth + 1
  let open = null
  let lines = []

  const close = function* () {
    if (!open) return
    const words = lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim()
    yield {
      location_id: open.location_id,
      doc_type: "SECTION",
      doc_level_id: open.number,
      title: open.title,
      parent_location_id: open.parent,
      depth: open.depth,
      repealed: /\brepealed\b/i.test(open.title ?? ""),
      text: [open.head, words].filter(Boolean).join("\n\n") || null,
    }
    open = null
    lines = []
  }

  for (const p of paragraphs) {
    const flat = line(p.html)
    if (!flat) continue

    const opening = opensASection(p.html, flat)
    if (opening) {
      yield* close()
      const location_id = unique(opening.number, seen)
      seen.add(location_id)
      open = {
        location_id,
        number: opening.number,
        title: opening.title,
        parent,
        depth,
        head: `${opening.label} ${opening.number}. ${opening.title ?? ""}`.trim(),
      }
      lines = opening.rest ? [opening.rest] : []
      continue
    }

    // A centred bold paragraph is a heading: the next subchapter, or the code
    // and chapter the document reprints above its first section.
    if (p.centred && p.bold) {
      yield* close()
      const { doc_type, doc_level_id, title } = readHeading(flat)
      if (doc_type === "CHAPTER" || doc_type === "TITLE" || doc_type === "SUBTITLE" || !doc_level_id) continue
      const location_id = unique(`${chapter.location_id}-${doc_type}-${doc_level_id}`, seen)
      seen.add(location_id)
      yield { location_id, doc_type, doc_level_id, title, parent_location_id: chapter.location_id, depth: chapter.depth + 1 }
      parent = location_id
      depth = chapter.depth + 2
      continue
    }

    if (open) lines.push(flat)
  }
  yield* close()
}

/**
 * Whether a paragraph opens a section, and with what.
 *
 * The number and catchline sit in the paragraph's first link, which the
 * Council sets in bold; the words of the law follow in the same paragraph.
 * Vernon's Civil Statutes number by article rather than section, and the
 * Constitution by article and section both.
 */
function opensASection(inner, flat) {
  const first = elements(inner, "a").next().value
  const label = first ? line(first.inner) : ""
  const m = /^(Sec|Art|Article|Section)\.?\s*([0-9A-Za-z][0-9A-Za-z\u2013-]*(?:\.[0-9A-Za-z\u2013-]+)*)\.\s*(.*)$/s.exec(label || flat)
  if (!m) return null
  // A cross-reference in the middle of a sentence is a link too; a section
  // opens its own paragraph.
  if (label && !flat.startsWith(label.slice(0, 12))) return null
  const number = m[2].replace(/\.$/, "")
  if (!/[0-9]/.test(number)) return null
  const after = label ? line(inner.slice(first.end)) : ""
  let catchline = m[3].replace(/\s+/g, " ").trim()
  let rest = after
  if (!label) {
    // No link at all — the whole paragraph is the section, so the catchline
    // runs until the law's first lower-case word.
    const cut = /^([^a-z]{2,}?[.:])\s+(?=\S)/.exec(catchline)
    rest = cut ? catchline.slice(cut[0].length).trim() : ""
    catchline = cut ? cut[1] : catchline
  }
  return {
    label: /^Art/i.test(m[1]) ? "Art." : "Sec.",
    number,
    title: titleCase(catchline.replace(/[.:]\s*$/, "")) || null,
    rest,
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
