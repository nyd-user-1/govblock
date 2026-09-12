// Washington — the Revised Code of Washington, from the Code Reviser.
//
// `app.leg.wa.gov/RCW/default.aspx?cite=…` is the same page at three depths:
// no citation lists the ninety-one titles, a title lists its chapters, a
// chapter lists its sections, and a section carries the law, the session laws
// that made it in square brackets, and the Reviser's notes under them.
//
// The Reviser's bulk download moved and its old address answers "Page not
// found" with a 200, which is why this state sat sized rather than loaded. It
// does not need the bulk file: the pool reads the thirty thousand section
// pages in an hour, and nothing about the Reviser's own notes belongs to a
// vendor — Washington publishes its own code.
//
// A law here is a title, which is how Washington cites: "RCW 1.04.010" is
// title 1, chapter 04, section 010.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const PAGE = (cite) => `https://app.leg.wa.gov/RCW/default.aspx${cite ? `?cite=${cite}` : ""}`

/** Every `cite=` a page links to, with the text of its row beside it. */
function cited(html, depth) {
  const out = []
  for (const row of elements(html, "tr")) {
    for (const a of elements(row.inner, "a")) {
      const cite = /[?&]cite=([0-9][0-9A-Za-z.]*)(?:["&]|$)/.exec(attrs(a.head).href ?? "")?.[1]
      if (!cite || cite.split(".").length !== depth) continue
      if (out.some((x) => x.cite === cite)) continue
      // The row is the citation and then the heading. The HTML and PDF
      // buttons beside them are the site's, and they sit in adjacent links
      // with no space between, so they are cut as elements rather than as
      // words — flattening first turns them into "HTMLPDF".
      const name = line(row.inner.replace(/<a\b[^>]*class=["'][^"']*\bbtn\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, " "))
        .replace(cite, " ")
        .replace(/\s+/g, " ")
        .trim()
      out.push({ cite, name: titleCase(name) || null })
      break
    }
  }
  return out
}

export default {
  id: "wa-codereviser",
  name: "Washington Code Reviser — the Revised Code of Washington",
  states: ["WA"],
  source: "https://app.leg.wa.gov/RCW/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, PAGE(""))
    const titles = []
    for (const row of elements(index, "tr")) {
      const flat = line(row.inner).replace(/\s+/g, " ").trim()
      const m = /^Title\s+([0-9A-Za-z.]+)\s*(.*)$/i.exec(flat)
      if (!m || titles.some((t) => t.number === m[1])) continue
      titles.push({ number: m[1], name: titleCase(m[2]) || null })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const law_id = `T${title.number.toUpperCase()}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const contents = await fetchDoc(state, PAGE(title.number), { notFound: null })
      const chapters = contents ? cited(contents, 2) : []
      if (!chapters.length) {
        log(`✗ ${law_id} — the title lists no chapter`)
        continue
      }

      // Each chapter's section list, then every section, both at the pool's
      // pace rather than one chapter at a time.
      const lists = await map(chapters, 10, (chapter) => fetchDoc(state, PAGE(chapter.cite), { notFound: null }))
      const plan = []
      for (let i = 0; i < chapters.length; i++) {
        plan.push({ kind: "CHAPTER", ...chapters[i] })
        for (const section of lists[i] ? cited(lists[i], 3) : []) plan.push({ kind: "SECTION", ...section })
      }
      const sections = plan.filter((p) => p.kind === "SECTION")
      if (!sections.length) {
        log(`✗ ${law_id} — the chapters list no section`)
        continue
      }

      let at = 0
      const bodies = await map(sections, 12, async (section) => {
        const html = await fetchDoc(state, PAGE(section.cite), { notFound: null })
        at += 1
        if (at % 1000 === 0) log(`  ${law_id} ${at}/${sections.length} sections`)
        return html
      })

      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: title.number, title: title.name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      let parent = "TITLE"
      let read = 0

      for (const item of plan) {
        if (item.kind === "CHAPTER") {
          const location_id = unique(item.cite, seen)
          seen.add(location_id)
          nodes.push({
            location_id,
            doc_type: "CHAPTER",
            doc_level_id: item.cite.split(".").slice(1).join("."),
            title: item.name,
            parent_location_id: "TITLE",
            depth: 1,
          })
          parent = location_id
          continue
        }
        const html = bodies[read++]
        const location_id = unique(item.cite, seen)
        seen.add(location_id)
        const body = html ? readSection(html) : null
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: item.cite,
          title: item.name,
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(item.name ?? ""),
          text: [`RCW ${item.cite} ${item.name ?? ""}`.trim(), body].filter(Boolean).join("\n\n"),
        })
      }

      log(`${law_id} · ${chapters.length} chapters · ${sections.length.toLocaleString("en-US")} sections · ${title.name}`)
      yield { law_id, law_name: title.name || `Title ${title.number}`, law_type: "CONSOLIDATED", chapter: title.number, nodes: inOrder(nodes) }
    }
  },
}

/** A section page: the law, its session laws, and the Reviser's notes. */
function readSection(html) {
  for (const wrapper of elements(html, "div", /id=["']contentWrapper["']/)) return text(wrapper.inner) || null
  return null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
