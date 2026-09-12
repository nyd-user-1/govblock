// Kansas — the Kansas Statutes Annotated, from the Office of Revisor of
// Statutes.
//
// `ksrevisor.gov/ksa.html` names every chapter, a chapter page lists its
// articles and the sections under each with their catchlines, and a section is
// its own file at `/statutes/chapters/chNN/NNN_AAA_SSSS.html`.
//
// The Office says on its own index that the authenticated text is the printed
// bound volumes; what it serves here is the same statute, and that line is
// what the `/laws/ks` page's snapshot note is for.
//
// A law here is a chapter, which is what Kansas cites: "K.S.A. 1-201" is
// chapter 1, article 2, section 01.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.ksrevisor.gov"

export default {
  id: "ks-revisor",
  name: "Kansas Office of Revisor of Statutes — the Kansas Statutes Annotated",
  states: ["KS"],
  source: "https://www.ksrevisor.gov/ksa.html",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/ksa.html`)
    const chapters = []
    for (const a of elements(index, "a")) {
      const m = /^\/statutes\/ksa_ch([0-9A-Za-z]+)\.html$/.exec(attrs(a.head).href ?? "")
      if (!m || chapters.some((c) => c.number === m[1])) continue
      const label = line(a.inner).replace(/\s+/g, " ").trim()
      chapters.push({ number: m[1], name: titleCase(label.replace(/^Chapter\s+[0-9A-Za-z]+\.?\s*[—–-]*\s*/i, "")) })
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0

    for (const chapter of wanted) {
      at += 1
      if (at % 10 === 0) log(`${at}/${wanted.length} chapters`)
      const page = await fetchDoc(state, `${BASE}/statutes/ksa_ch${chapter.number}.html`, { notFound: null })
      if (!page) continue

      // The chapter is a nested list: an article heading with its own sections
      // in a list inside it. The element walker skips nesting of the same tag
      // on purpose, so the outer items are walked first and each one's inner
      // items after — which is also the order the Office prints them.
      const plan = []
      for (const article of elements(page, "li")) {
        const inner = [...elements(article.inner, "li")]
        if (!inner.length) continue
        const heading = line([...elements(article.inner, "a")][0]?.inner ?? "").replace(/\s+/g, " ").trim()
        const m = /^Article\s+([0-9A-Za-z]+)\.?\s*[—–-]*\s*(.*)$/i.exec(heading)
        if (m) plan.push({ kind: "ARTICLE", number: m[1], name: titleCase(m[2]) || null })
        for (const li of inner) {
          const a = [...elements(li.inner, "a")].find((x) => /\/statutes\/chapters\//.test(attrs(x.head).href ?? ""))
          if (!a) continue
          const href = attrs(a.head).href
          if (plan.some((x) => x.href === href)) continue
          // "1-201" sits in the item before the link; a repealed run reads
          // "1-101 through 1-109".
          const number = line(li.inner.slice(0, li.inner.indexOf("<a"))).replace(/\s+/g, " ").trim()
          if (!number) continue
          plan.push({ kind: "SECTION", href, number, name: titleCase(line(a.inner).replace(/\s+/g, " ").trim().replace(/\.$/, "")) })
        }
      }
      const sections = plan.filter((p) => p.kind === "SECTION")
      if (!sections.length) continue

      const bodies = await map(sections, 10, (s) => fetchDoc(state, `${BASE}${s.href}`, { notFound: null }))

      const nodes = [
        { location_id: "CHAPTER", doc_type: "CHAPTER", doc_level_id: chapter.number, title: chapter.name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["CHAPTER"])
      let parent = "CHAPTER"
      let read = 0

      for (const item of plan) {
        if (item.kind === "ARTICLE") {
          const location_id = unique(`a${item.number}`, seen)
          seen.add(location_id)
          nodes.push({ location_id, doc_type: "ARTICLE", doc_level_id: item.number, title: item.name, parent_location_id: "CHAPTER", depth: 1 })
          parent = location_id
          continue
        }
        const html = bodies[read++]
        const location_id = unique(item.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: item.number,
          title: item.name,
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(item.name ?? ""),
          text: (html ? readSection(html) : null) ?? `${item.number}. ${item.name ?? ""}`.trim(),
        })
      }

      log(`C${chapter.number} · ${sections.length} sections · ${chapter.name}`)
      yield {
        law_id: `C${chapter.number}`,
        law_name: chapter.name || `Chapter ${chapter.number}`,
        law_type: "CONSOLIDATED",
        chapter: chapter.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

/** One section file: the `div#print` the Office sets the statute in. */
function readSection(html) {
  for (const block of elements(html, "div", /id=["']print["']/)) {
    const words = text(block.inner)
    if (words) return words
  }
  return null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
