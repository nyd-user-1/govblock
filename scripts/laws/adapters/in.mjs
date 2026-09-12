// Indiana — the Indiana Code, from the General Assembly.
//
// `iga.in.gov` is a React application with no statute in its HTML, and the
// MyIGA key that was asked for has not come back. It is not needed: the
// application's own bundle names where it reads the Code from, and it is a
// static document per title —
//
//   https://iga.in.gov/ic/<year>/Title_<n>.html
//
// — a WordPerfect export the Assembly publishes, with its own structure in the
// markup: a `div.title` for the title, a `div.article`, `div.chapter` and
// `div.section`, each carrying its citation and its heading, and the law in
// the paragraphs between them.
//
// A law here is a title, which is how Indiana cites: "IC 1-1-1-1" is title 1,
// article 1, chapter 1, section 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const YEAR = process.env.IN_CODE_YEAR || "2025"
const FILE = (n) => `https://iga.in.gov/ic/${YEAR}/Title_${n}.html`

// Indiana numbers its titles 1 to 36 and hangs lettered ones beside them.
const TITLES = []
for (let n = 1; n <= 36; n++) for (const letter of ["", "A", "B"]) TITLES.push(`${n}${letter}`)

const LEVELS = { article: "ARTICLE", chapter: "CHAPTER" }

export default {
  id: "in-iga",
  name: "Indiana General Assembly — the Indiana Code",
  states: ["IN"],
  source: "https://iga.in.gov/laws/2025/ic/titles/1",

  async *laws({ state, only, have, log }) {
    const wanted = TITLES.filter((t) => (!only || `T${t}` === only.toUpperCase()) && !have?.has(`T${t}`))
    let at = 0
    // The edge in front of the documents sometimes answers with the React
    // application's own shell instead; that is not a title, whether it comes
    // back from the network or from the cache.
    const isTitle = (body) => body.length > 5000 && /class="title"/.test(body)
    const documents = await map(wanted, 8, async (t) => {
      const html = await fetchDoc(state, FILE(t), { notFound: null, validate: isTitle })
      at += 1
      if (at % 20 === 0) log(`${at}/${wanted.length} title numbers tried`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const html = documents[i]
      if (!html) continue
      const law = read(html, wanted[i])
      if (!law) {
        log(`· title ${wanted[i]} — the document carries no section`)
        continue
      }
      log(`T${wanted[i]} · ${law.nodes.filter((n) => n.doc_type === "SECTION").length} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(html, number) {
  const law_name = titleCase(
    (/<meta name="T_ICTITLE_S_NAME" content="([^"]*)"/.exec(html)?.[1] ?? "").replace(/^TITLE\s+[0-9A-Za-z]+\.\s*/i, "")
  )

  // The document's own divisions, in the order they are printed: the title,
  // its articles and chapters, and its sections.
  const marks = []
  for (const kind of ["title", "article", "chapter", "section"]) {
    for (const d of elements(html, "div", new RegExp(`class="${kind}"`))) {
      marks.push({ at: d.index, kind, head: d.head, inner: d.inner, end: d.end })
    }
  }
  marks.sort((a, b) => a.at - b.at)
  if (!marks.some((m) => m.kind === "section")) return null

  const nodes = [
    { location_id: "TITLE", doc_type: "TITLE", doc_level_id: number, title: law_name || `Title ${number}`, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["TITLE"])
  let article = "TITLE"
  let chapter = "TITLE"

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i]
    if (mark.kind === "title") continue
    const id = (attrs(mark.head).id ?? "").trim()
    if (!id) continue
    // "IC 1-1-1" in one cell and the heading in the next.
    const cells = [...elements(mark.inner, "span")].map((s) => line(s.inner).trim())
    const heading = cells.find((c, n) => n > 0 && c) ?? ""

    if (mark.kind !== "section") {
      const location_id = unique(id, seen)
      seen.add(location_id)
      nodes.push({
        location_id,
        doc_type: LEVELS[mark.kind],
        doc_level_id: id.split("-").slice(1).join("-") || id,
        title: titleCase(heading) || null,
        parent_location_id: mark.kind === "article" ? "TITLE" : article,
        depth: mark.kind === "article" ? 1 : 2,
      })
      if (mark.kind === "article") {
        article = location_id
        chapter = location_id
      } else {
        chapter = location_id
      }
      continue
    }

    // A section's words run from its heading to whatever the document opens
    // next, which is the only boundary the export gives.
    const until = marks[i + 1] ? marks[i + 1].at : html.length
    const words = text(html.slice(mark.end, until))
    const location_id = unique(id, seen)
    seen.add(location_id)
    nodes.push({
      location_id,
      doc_type: "SECTION",
      doc_level_id: id,
      title: titleCase(heading) || null,
      parent_location_id: chapter,
      depth: 3,
      repealed: /\brepealed\b/i.test(heading),
      text: [`IC ${id} ${heading}`.trim(), words].filter(Boolean).join("\n\n") || null,
    })
  }

  return { law_id: `T${number}`, law_name: law_name || `Title ${number}`, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
