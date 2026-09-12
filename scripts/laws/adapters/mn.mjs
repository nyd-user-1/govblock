// Minnesota — the Minnesota Statutes, from the Office of the Revisor.
//
// `revisor.mn.gov/statutes/cite/<chapter>` is a chapter's table of sections and
// `…/cite/<chapter>.<section>` is the section itself: a `div.section` with the
// number and headnote in an `h1`, the law in paragraphs under it, and the
// Revisor's history line in a block of its own.
//
// The Revisor publishes no machine-readable list of chapters — the contents
// page is a PDF — so the chapters are enumerated. Minnesota numbers them 1 to
// 645 and hangs lettered chapters off many of them (13A, 62Q, 216B), so every
// number is tried bare and with a letter, and the ones Minnesota does not use
// answer 404 and are remembered as gaps rather than asked for twice.
//
// A law here is a chapter, which is what Minnesota cites: "Minn. Stat. § 1.01"
// is section 01 of chapter 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.revisor.mn.gov"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

const LETTERS = ["", "A", "B", "C", "D", "E"]
const CHAPTERS = []
for (let n = 1; n <= 700; n++) for (const letter of LETTERS) CHAPTERS.push(`${n}${letter}`)

export default {
  id: "mn-revisor",
  name: "Minnesota Office of the Revisor — the Minnesota Statutes",
  states: ["MN"],
  source: "https://www.revisor.mn.gov/statutes/",

  async *laws({ state, only, have, log }) {
    const wanted = CHAPTERS.filter((c) => (!only || `C${c}` === only.toUpperCase()) && !have?.has(`C${c}`))
    let tried = 0
    const contents = await map(wanted, 16, async (c) => {
      const html = await fetchDoc(state, `${BASE}/statutes/cite/${c}`, { notFound: null })
      tried += 1
      if (tried % 500 === 0) log(`${tried}/${wanted.length} chapter numbers tried`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const chapter = wanted[i]
      const page = contents[i]
      if (!page) continue
      const own = line([...elements(page, "h2", cls("chapter_title"))][0]?.inner ?? "")
      const named = new RegExp(`^CHAPTER\\s+${chapter}\\.?\\s*(.*)$`, "i").exec(own.replace(/\s+/g, " ").trim())
      // A number the Revisor serves with no chapter heading is not a chapter.
      if (!named) continue
      const law_name = titleCase(named[1].replace(/\.$/, "")) || `Chapter ${chapter}`

      const listed = []
      for (const a of elements(page, "a")) {
        const m = new RegExp(`/statutes/(?:\\d{4}/)?cite/(${chapter}\\.[0-9A-Za-z.-]+)$`).exec(attrs(a.head).href ?? "")
        if (!m || listed.some((s) => s.number === m[1])) continue
        listed.push({ number: m[1] })
      }
      if (!listed.length) continue

      const bodies = await map(listed, 12, (s) => fetchDoc(state, `${BASE}/statutes/cite/${s.number}`, { notFound: null }))

      const nodes = [
        { location_id: "CHAPTER", doc_type: "CHAPTER", doc_level_id: chapter, title: law_name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["CHAPTER"])
      for (let j = 0; j < listed.length; j++) {
        const number = listed[j].number
        const read = bodies[j] ? readSection(bodies[j], number) : null
        const location_id = unique(number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: number,
          title: read?.title ?? null,
          parent_location_id: "CHAPTER",
          depth: 1,
          repealed: /\brepealed\b/i.test(read?.title ?? ""),
          text: read?.text ?? null,
        })
      }
      if (!nodes.some((n) => n.text)) continue

      log(`C${chapter} · ${nodes.length - 1} sections · ${law_name}`)
      yield { law_id: `C${chapter}`, law_name, law_type: "CONSOLIDATED", chapter, nodes: inOrder(nodes) }
    }
  },
}

/** A section page: its headnote, the law, and the Revisor's history line. */
function readSection(html, number) {
  const at = new RegExp(`id="stat\\.${number.replace(/\./g, "\\.")}"`)
  const block = [...elements(html, "div", cls("section"))].find((d) => at.test(d.head))
  // A repealed section is printed as `div.sr` — the number and the act that
  // repealed it, and no body, which is the Revisor's own answer and is kept.
  if (!block) {
    const struck = [...elements(html, "div", cls("sr"))].find((d) => at.test(d.head))
    if (!struck) return null
    const words = text(struck.inner)
    return { title: titleCase(/\[([^\]]+)\]/.exec(words)?.[1]?.split(",")[0] ?? "") || null, text: words || null }
  }
  const heading = line([...elements(block.inner, "h1", cls("shn"))][0]?.inner ?? "")
  const title = titleCase(heading.replace(new RegExp(`^${number.replace(/\./g, "\\.")}\\s*`), "").replace(/\.$/, "")) || null
  const history = [...elements(html, "div", cls("history"))]
    .map((h) => text(h.inner))
    .filter(Boolean)
    .join("\n")
  const words = text(block.inner)
  return { title, text: [words, history].filter(Boolean).join("\n\n") || null }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
