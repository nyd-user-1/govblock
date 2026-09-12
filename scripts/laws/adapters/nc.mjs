// North Carolina — the General Statutes, from the General Assembly.
//
// `ncleg.gov` publishes each chapter as one HTML file — the whole of Chapter 1
// is a single 1.1 MB document — so the state is a hundred and seventy requests
// rather than thirty thousand. The files are a word-processor's export and
// their class names are hashes that change from document to document, so
// nothing here reads a class: the General Assembly's own typography is the
// structure. A heading is what it says it is.
//
//   <h3>   Chapter 1.  /  Civil Procedure.
//   <h4>   SUBCHAPTER I. DEFINITIONS AND GENERAL PROVISIONS.
//   <p>    Article 1.  /  Definitions.
//   <p>    § 1-1.  Remedies.          ← a section opens
//   <p>    …the words of the law, one paragraph each, the last carrying the
//          session laws that made it, in parentheses.
//
// A law here is a chapter, which is the unit North Carolina cites: "N.C.G.S.
// § 1-1" is section 1 of Chapter 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { elements, line } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const TOC = "https://www.ncleg.gov/Laws/GeneralStatutesTOC"
const CHAPTER = (n) => `https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_${n}.html`

// "§ 1-1.  Remedies." — and, where a whole run was repealed at once, "§§ 2-1
// through 2-60.  Repealed and transferred by Session Laws 1971, c. 363." The
// General Assembly prints that as one entry of the chapter, and it is one
// citable place in the Statutes, so it is kept as one rather than lost.
const SECTION =
  /^§+\s*([0-9A-Za-z][0-9A-Za-z.‐-―-]*?)(?:\s+(?:through|to|and)\s+([0-9A-Za-z][0-9A-Za-z.‐-―-]*?))?\s*[.:]\s*(.*)$/s
const ARTICLE = /^(Article|Part|Subpart)\s+([0-9A-Za-z.-]+?)\.?\s*(?:\.|$)\s*(.*)$/i
const SUBCHAPTER = /^(SUBCHAPTER|ARTICLE|PART)\s+([0-9A-Za-z.-]+?)\.?\s*[.:]?\s*(.*)$/i

export default {
  id: "nc-ncleg",
  name: "North Carolina General Assembly — the General Statutes",
  states: ["NC"],
  source: "https://www.ncleg.gov/Laws/GeneralStatutes",

  async *laws({ state, only, have, log }) {
    const toc = await fetchDoc(state, TOC)
    const chapters = []
    for (const a of elements(toc, "a")) {
      const m = /Chapter_([0-9A-Za-z]+)\.html/.exec(a.head)
      if (!m || chapters.some((c) => c.number === m[1])) continue
      chapters.push({ number: m[1], name: titleCase(line(a.inner).replace(/^Chapter\s+[0-9A-Za-z]+\s*[-.]?\s*/i, "")) })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0
    const documents = await map(wanted, 8, async (chapter) => {
      const html = await fetchDoc(state, CHAPTER(chapter.number), { notFound: null })
      at += 1
      if (at % 25 === 0) log(`${at}/${wanted.length} chapters fetched`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const chapter = wanted[i]
      const html = documents[i]
      if (!html) {
        log(`✗ chapter ${chapter.number} — no document`)
        continue
      }
      const law = read(html, chapter)
      log(`C${chapter.number} · ${law.nodes.filter((n) => n.doc_type === "SECTION").length} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(html, chapter) {
  const body = html.slice(html.indexOf("<body"))
  // The document in order: its headings at the weight they were given, and its
  // paragraphs. An `h3` is the chapter's own name, an `h4` a subchapter.
  const blocks = []
  for (const e of elements(body, "h3")) blocks.push({ at: e.index, weight: 3, flat: line(e.inner) })
  for (const e of elements(body, "h4")) blocks.push({ at: e.index, weight: 4, flat: line(e.inner) })
  for (const e of elements(body, "p")) blocks.push({ at: e.index, weight: 0, flat: line(e.inner) })
  blocks.sort((a, b) => a.at - b.at)

  const nodes = [
    {
      location_id: "CHAPTER",
      doc_type: "CHAPTER",
      doc_level_id: chapter.number,
      title: chapter.name || null,
      parent_location_id: null,
      depth: 0,
    },
  ]
  const seen = new Set(["CHAPTER"])
  let under = "CHAPTER"
  let subchapter = null
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
      repealed: /\brepealed\b/i.test([open.title, lines[0]].join(" ")),
      text: [`${open.number.includes(" through ") ? "§§" : "§"} ${open.number}. ${open.title ?? ""}`.trim(), ...lines].filter(Boolean).join("\n\n") || null,
    })
    open = null
    lines = []
  }

  // A heading North Carolina sets across two paragraphs — "Article 1." then
  // "Definitions." — is one heading, so a name with no number of its own is
  // given to the level that opened just before it.
  let awaitingName = null

  for (const block of blocks) {
    const flat = block.flat.replace(/ /g, " ").trim()
    if (!flat) continue

    if (awaitingName && !open && block.weight === 0 && !SECTION.test(flat) && !ARTICLE.test(flat)) {
      const level = nodes[nodes.length - 1]
      if (level && level.location_id === awaitingName && !level.title) level.title = titleCase(flat.replace(/\.$/, ""))
      awaitingName = null
      continue
    }
    awaitingName = null

    const section = SECTION.exec(flat)
    if (section && block.weight === 0) {
      close()
      const dashes = (n) => n.replace(/[‐-―]/g, "-")
      const number = section[2] ? `${dashes(section[1])} through ${dashes(section[2])}` : dashes(section[1])
      const location_id = unique(number, seen)
      seen.add(location_id)
      // The catchline, and sometimes the first words of the law behind it on
      // the same line.
      const rest = section[3].replace(/\s+/g, " ").trim()
      const cut = /^(.*?\.)\s+(?=[A-Z(])/.exec(rest)
      open = { location_id, number, title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null, parent: under }
      lines = cut ? [rest.slice(cut[0].length).trim()] : []
      continue
    }

    if (block.weight === 4 || (block.weight === 3 && SUBCHAPTER.test(flat) && !/^Chapter\b/i.test(flat))) {
      close()
      const m = SUBCHAPTER.exec(flat)
      if (!m) continue
      const location_id = unique(`sub-${m[2]}`, seen)
      seen.add(location_id)
      nodes.push({
        location_id,
        doc_type: "SUBCHAPTER",
        doc_level_id: m[2],
        title: titleCase(m[3].replace(/\.$/, "")) || null,
        parent_location_id: "CHAPTER",
        depth: 0,
      })
      subchapter = location_id
      under = location_id
      if (!m[3]) awaitingName = location_id
      continue
    }

    if (block.weight === 0 && !open) {
      const article = ARTICLE.exec(flat)
      if (article) {
        const kind = article[1].toUpperCase()
        const location_id = unique(`${kind.toLowerCase()}-${article[2]}`, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: kind,
          doc_level_id: article[2],
          title: titleCase(article[3].replace(/\.$/, "")) || null,
          parent_location_id: subchapter ?? "CHAPTER",
          depth: 0,
        })
        under = location_id
        if (!article[3]) awaitingName = location_id
        continue
      }
    }

    if (open) lines.push(flat)
  }
  close()

  return {
    law_id: `C${chapter.number}`,
    law_name: chapter.name || `Chapter ${chapter.number}`,
    law_type: "CONSOLIDATED",
    chapter: chapter.number,
    nodes: inOrder(nodes),
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
