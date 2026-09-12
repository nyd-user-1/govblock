// Arizona — the Revised Statutes, from the Legislative Council.
//
// `azleg.gov/arsDetail/?title=N` lists a title's chapters and articles with a
// link to every section, and each section is its own small file at
// `azleg.gov/ars/<title>/<number>.htm` — a few hundred bytes of the Council's
// own markup, the number in green and the catchline underlined in purple.
// About thirty thousand of them across the state, which is an hour of the
// pool's time rather than a week.
//
// A law here is a title, which is how Arizona cites: "A.R.S. § 1-101" is
// section 101 of title 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.azleg.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

export default {
  id: "az-azleg",
  name: "Arizona Legislative Council — the Arizona Revised Statutes",
  states: ["AZ"],
  source: "https://www.azleg.gov/arstitle/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/arstitle/`)
    // The index is a table: a checkbox, the title's designation as a link, and
    // its name in the cell beside it. The link says only "Title 1", so the
    // name is the next cell rather than anything inside the link.
    const titles = []
    for (const row of elements(index, "tr")) {
      const m = /arsDetail\/?\?title=([0-9A-Za-z.]+)/.exec(row.inner)
      if (!m || titles.some((t) => t.number === m[1])) continue
      const cells = [...elements(row.inner, "td")].map((td) => line(td.inner).trim())
      const name = cells.find((c, i) => i > 0 && c && !/^Title\s/i.test(c)) ?? ""
      titles.push({ number: m[1], name: titleCase(name) || `Title ${m[1]}` })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const law_id = `T${title.number.toUpperCase()}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const detail = await fetchDoc(state, `${BASE}/arsDetail/?title=${title.number}`, { notFound: null })
      if (!detail) {
        log(`✗ ${law_id} — no contents page`)
        continue
      }
      const plan = readContents(detail)
      const sections = plan.filter((p) => p.kind === "SECTION")
      if (!sections.length) {
        log(`✗ ${law_id} — the contents name no section`)
        continue
      }

      let at = 0
      const bodies = await map(sections, 12, async (s) => {
        const html = await fetchDoc(state, s.url, { notFound: null })
        at += 1
        if (at % 1000 === 0) log(`  ${law_id} ${at}/${sections.length} sections`)
        return html
      })

      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: title.number, title: title.name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      let chapter = "TITLE"
      let parent = "TITLE"
      let read = 0

      for (const item of plan) {
        if (item.kind === "CHAPTER") {
          const location_id = unique(`ch${item.number}`, seen)
          seen.add(location_id)
          nodes.push({ location_id, doc_type: "CHAPTER", doc_level_id: item.number, title: item.name, parent_location_id: "TITLE", depth: 1 })
          chapter = location_id
          parent = location_id
          continue
        }
        if (item.kind === "ARTICLE") {
          const location_id = unique(`${chapter}-a${item.number}`, seen)
          seen.add(location_id)
          nodes.push({ location_id, doc_type: "ARTICLE", doc_level_id: item.number, title: item.name, parent_location_id: chapter, depth: 2 })
          parent = location_id
          continue
        }
        const html = bodies[read++]
        const location_id = unique(item.number, seen)
        seen.add(location_id)
        const body = html ? readSection(html) : null
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: item.number,
          title: item.name,
          parent_location_id: parent,
          depth: 3,
          repealed: /\brepealed\b/i.test(item.name ?? ""),
          text: body ?? `${item.number}. ${item.name ?? ""}`.trim(),
        })
      }

      log(`${law_id} · ${sections.length.toLocaleString("en-US")} sections · ${title.name}`)
      yield { law_id, law_name: title.name || `Title ${title.number}`, law_type: "CONSOLIDATED", chapter: title.number, nodes: inOrder(nodes) }
    }
  },
}

/**
 * A title's contents, in printed order: its chapters, the articles inside
 * them, and the sections under each article.
 *
 * The page is an accordion — a `<h5>` per chapter, a `div.article` per article,
 * and a `<ul>` per section with its number in the link and its catchline in
 * the cell beside it — so the order of the elements is the order of the Code.
 */
function readContents(html) {
  const out = []
  const marks = []
  for (const h of elements(html, "h5")) marks.push({ at: h.index, kind: "CHAPTER", html: h.inner })
  for (const d of elements(html, "div", cls("article"))) marks.push({ at: d.index, kind: "ARTICLE", html: d.inner })
  for (const u of elements(html, "ul")) marks.push({ at: u.index, kind: "SECTION", html: u.inner })
  marks.sort((a, b) => a.at - b.at)

  for (const mark of marks) {
    if (mark.kind === "SECTION") {
      const a = [...elements(mark.html, "a", cls("stat"))][0]
      if (!a) continue
      const url = /docName=(https?:\/\/[^"&]+)/.exec(a.head)?.[1]
      if (!url) continue
      const cells = [...elements(mark.html, "li")].map((li) => line(li.inner))
      out.push({ kind: "SECTION", url, number: line(a.inner), name: titleCase(cells[1] ?? "") || null })
      continue
    }
    // "Chapter 1" and its name sit in separate cells of the heading, and are
    // read as separate cells: flattening them first runs "Article 1" into "In
    // General" and makes the article number "1In".
    const designation = [...elements(mark.html, "a")][0]
    if (!designation) continue
    const m = new RegExp(`^${mark.kind}\\s+([0-9A-Za-z.-]+)$`, "i").exec(line(designation.inner).trim())
    if (!m) continue
    const rest = mark.html.slice(designation.end)
    const name = [...elements(rest, "div"), ...elements(rest, "span")].map((e) => line(e.inner).trim()).find(Boolean)
    out.push({ kind: mark.kind, number: m[1], name: titleCase(name ?? "") || null })
  }
  // An article's sections are listed inside its own div as well as after it,
  // so a section seen twice is one section.
  const once = []
  const seen = new Set()
  for (const item of out) {
    const key = `${item.kind}:${item.number}:${item.url ?? ""}`
    if (item.kind === "SECTION" && seen.has(key)) continue
    seen.add(key)
    once.push(item)
  }
  return once
}

/** One section file: the number, the catchline, and the words under them. */
function readSection(html) {
  const body = html.slice(html.search(/<body/i))
  const words = text(body)
  return words || null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
