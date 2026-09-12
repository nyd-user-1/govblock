// Utah — the Utah Code, from the Office of Legislative Research and General
// Counsel.
//
// `le.utah.gov/xcode` renders on the client and its pretty addresses answer
// 404, which is why this state sat blocked. Under them is a plain file tree
// keyed by version — `xcode/C_<version>.html` is the index of titles,
// `Title3/C3_<version>.html` a title, `Title3/Chapter1/C3-1_<version>.html` a
// chapter — and beside each of those the Office publishes the same thing as
// **XML**:
//
//   <chapter number="3-1"><catchline>…</catchline>
//     <section number="3-1-1"><histories>…</histories><catchline>…</catchline>
//       the words of the law
//
// which is better than any of the HTML: the structure is the Office's own and
// nothing is inferred.
//
// A law here is a chapter, which is what Utah cites: "Utah Code § 3-1-1" is
// title 3, chapter 1, section 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line } from "../lib/html.mjs"
import { childText, endOf, plain, without } from "../lib/xml.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://le.utah.gov/xcode"
const INDEX = process.env.UT_CODE_VERSION || "C_1800010118000101"

export default {
  id: "ut-olrgc",
  name: "Utah Office of Legislative Research and General Counsel — the Utah Code",
  states: ["UT"],
  source: "https://le.utah.gov/xcode/code.html",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/${INDEX}.html`)
    // Every title, with the version the Office currently publishes it at.
    const titles = []
    for (const a of elements(index, "a")) {
      const m = /^Title([0-9A-Za-z]+)\/[0-9A-Za-z]+\.html\?v=(C[0-9A-Za-z_]+)$/.exec(attrs(a.head).href ?? "")
      if (!m || titles.some((t) => t.number === m[1])) continue
      titles.push({ number: m[1], version: m[2], name: titleCase(line(a.inner).replace(/^Title\s+[0-9A-Za-z]+\s*/i, "")) })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const page = await fetchDoc(state, `${BASE}/Title${title.number}/${title.version}.html`, { notFound: null })
      if (!page) continue
      const chapters = []
      for (const a of elements(page, "a")) {
        const m = new RegExp(`Chapter([0-9A-Za-z]+)/[0-9A-Za-z.-]+\\.html\\?v=(C${title.number}-[0-9A-Za-z_]+)$`).exec(attrs(a.head).href ?? "")
        if (!m || chapters.some((c) => c.number === m[1])) continue
        chapters.push({ number: m[1], version: m[2], name: titleCase(line(a.inner).replace(/^Chapter\s+[0-9A-Za-z]+\s*/i, "")) })
      }

      const wanted = chapters.filter(
        (c) => (!only || `T${title.number}C${c.number}` === only.toUpperCase()) && !have?.has(`T${title.number}C${c.number}`)
      )
      if (!wanted.length) continue

      const documents = await map(wanted, 8, (c) =>
        fetchDoc(state, `${BASE}/Title${title.number}/Chapter${c.number}/${c.version}.xml`, { notFound: null })
      )

      for (let i = 0; i < wanted.length; i++) {
        const xml = documents[i]
        if (!xml) continue
        const law = read(xml, title, wanted[i])
        if (!law) continue
        log(`${law.law_id} · ${law.nodes.length - 1} sections · ${law.law_name}`)
        yield law
      }
    }
  },
}

function read(xml, title, chapter) {
  const law_name = titleCase(childText(xml, "catchline") ?? "") || chapter.name || `Chapter ${chapter.number}`
  const nodes = [
    {
      location_id: "CHAPTER",
      doc_type: "CHAPTER",
      doc_level_id: chapter.number,
      title: [law_name, title.name].filter(Boolean).join(" — "),
      parent_location_id: null,
      depth: 0,
    },
  ]
  const seen = new Set(["CHAPTER"])

  // One `<section>` per section: its histories, its catchline, and its words.
  const open = /<section\b[^>]*number="([^"]+)"[^>]*>/g
  let m
  while ((m = open.exec(xml))) {
    const end = endOf(xml, "section", m.index)
    const fragment = xml.slice(m.index, end)
    const number = m[1]
    if (seen.has(number)) continue
    seen.add(number)
    const catchline = childText(fragment, "catchline")
    const history = plain(childText(fragment, "histories") ?? "")
    // The words are everything the section holds but its own metadata.
    const words = plain(without(fragment, ["histories", "catchline"]))
    nodes.push({
      location_id: number,
      doc_type: "SECTION",
      doc_level_id: number,
      title: titleCase(catchline ?? "") || null,
      parent_location_id: "CHAPTER",
      depth: 1,
      repealed: /\brepealed\b/i.test(catchline ?? ""),
      text: [`${number}. ${catchline ?? ""}`.trim(), words, history].filter(Boolean).join("\n\n") || null,
    })
    open.lastIndex = end
  }
  if (nodes.length < 2) return null
  return {
    law_id: `T${title.number}C${chapter.number}`,
    law_name,
    law_type: "CONSOLIDATED",
    chapter: chapter.number,
    nodes: inOrder(nodes),
  }
}
