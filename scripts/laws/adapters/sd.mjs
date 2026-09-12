// South Dakota — the Codified Laws, from the Legislative Research Council.
//
// `sdlegislature.gov` is a Vue application, and `/api/Statutes/Title` — the one
// path that answers a plain GET — hands back all seventy-one titles but
// nothing under them. The rest of the API is in the application's own chunk,
// and the useful call is the one behind its "Printer Friendly" button:
//
//   /api/Statutes/<cite>.html?all=true
//
// which is the whole of a chapter, or the whole of a title, as one document.
// A chapter is asked for rather than a title because Title 1 alone is 7.8 MB.
//
// The Council marks its own structure in the markup: every section opens with
// a link whose text is the citation, a full stop, and then the catchline in a
// `CL` span, with the law in the paragraphs after it.
//
// A law here is a chapter, which is what South Dakota cites: "SDCL 1-1-1" is
// title 1, chapter 1, section 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://sdlegislature.gov/api/Statutes"

export default {
  id: "sd-lrc",
  name: "South Dakota Legislative Research Council — the Codified Laws",
  states: ["SD"],
  source: "https://sdlegislature.gov/Statutes",

  async *laws({ state, only, have, log }) {
    const titles = await fetchDoc(state, `${BASE}/Title`, { json: true })
    log(`${titles.length} titles`)

    // A title's own document names its chapters; asking for the title's HTML
    // would work too, and would be eight megabytes at a time.
    const chapters = []
    for (const title of titles) {
      const number = String(title.Statute ?? title.Title ?? "").trim()
      if (!number) continue
      chapters.push({ title: number, titleName: titleCase(String(title.CatchLine ?? "")) })
    }

    for (const t of chapters) {
      const contents = await fetchDoc(state, `${BASE}/${t.title}.html?all=false`, { notFound: null })
      // The title's contents link each of its chapters by citation.
      const numbers = contents
        ? [...new Set([...contents.matchAll(new RegExp(`/Statutes/(${t.title}-[0-9A-Za-z.]+)`, "g"))].map((m) => m[1]))]
        : []
      if (!numbers.length) {
        log(`✗ title ${t.title} — no chapter named`)
        continue
      }

      const wanted = numbers.filter((c) => (!only || `C${c}` === only.toUpperCase()) && !have?.has(`C${c}`))
      if (!wanted.length) continue
      const documents = await map(wanted, 8, (c) => fetchDoc(state, `${BASE}/${c}.html?all=true`, { notFound: null }))

      for (let i = 0; i < wanted.length; i++) {
        const html = documents[i]
        if (!html) continue
        const law = read(html, wanted[i], t.titleName)
        if (!law) {
          log(`· chapter ${wanted[i]} — the document carries no section`)
          continue
        }
        log(`C${wanted[i]} · ${law.nodes.length - 1} sections · ${law.law_name}`)
        yield law
      }
    }
  },
}

function read(html, chapter, titleName) {
  const whole = text(html)
  const heading = whole.split("\n").map((l) => l.trim()).filter(Boolean)
  const at = heading.findIndex((l) => new RegExp(`^CHAPTER\\s+${chapter}$`, "i").test(l))
  const law_name = titleCase(at >= 0 ? (heading[at + 1] ?? "") : "") || `Chapter ${chapter}`

  const nodes = [
    {
      location_id: "CHAPTER",
      doc_type: "CHAPTER",
      doc_level_id: chapter,
      title: [law_name, titleName].filter(Boolean).join(" — "),
      parent_location_id: null,
      depth: 0,
    },
  ]
  // Each section opens with a link whose text is its citation. The chapter
  // prints its own contents first in the same shape, so every citation appears
  // twice and the one carrying the law is the longer of the two.
  // The anchors are matched directly rather than walked as elements: the
  // document is the contents and the text concatenated, one anchor in it never
  // closes, and an element walker would swallow everything after it.
  // A section opens where the anchor is followed by the Council's catchline
  // span. The same anchor appears inside other sections as a cross reference,
  // and those are references rather than openings.
  const opens = []
  for (const m of html.matchAll(/<a\b[^>]*href="[^"]*Statute[s]?[=/]([0-9A-Za-z.-]+)"[^>]*>/gi)) {
    if (!m[1].startsWith(chapter + "-")) continue
    if (!/class="s\d+CL"/.test(html.slice(m.index, m.index + 400))) continue
    opens.push({ at: m.index, cite: m[1] })
  }

  const best = new Map()
  for (let i = 0; i < opens.length; i++) {
    const until = opens[i + 1] ? opens[i + 1].at : html.length
    const words = text(html.slice(opens[i].at, until)).trim()
    const previous = best.get(opens[i].cite)
    if (!previous || words.length > previous.length) best.set(opens[i].cite, words)
  }

  for (const [cite, words] of best) {
    // "1-1-1. Territorial extent of sovereignty…" — the citation, a full stop,
    // then the catchline, then the law.
    const heading = words.split("\n")[0] ?? ""
    const catchline = heading.slice(cite.length).replace(/^\s*\.?\s*/, "")
    nodes.push({
      location_id: cite,
      doc_type: "SECTION",
      doc_level_id: cite,
      title: titleCase(catchline.replace(/\.$/, "")) || null,
      parent_location_id: "CHAPTER",
      depth: 1,
      repealed: /\brepealed\b/i.test(catchline),
      text: words || null,
    })
  }
  if (nodes.length < 2) return null
  return { law_id: `C${chapter}`, law_name, law_type: "CONSOLIDATED", chapter, nodes: inOrder(nodes) }
}
