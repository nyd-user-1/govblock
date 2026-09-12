// Oregon — the Oregon Revised Statutes, from the Legislative Counsel.
//
// `oregonlegislature.gov/bills_laws/ors/orsNNN.html` is a whole chapter in one
// file, published as a word processor's HTML and served as ISO-8859-1. The
// chapter's own table of contents comes first — one line per section, number
// and catchline — and the law follows it, one paragraph per subsection, with
// each section opening on its number and catchline again and then running
// straight into the words.
//
// The Legislative Counsel's index page is a SharePoint shell that names no
// chapter, so the chapters are enumerated: `ors001` to `ors900`, and the
// numbers Oregon does not use answer 404 and are remembered as gaps rather
// than asked for twice.
//
// A law here is a chapter, which is what Oregon cites: "ORS 1.002" is section
// 002 of chapter 1. The title above it is printed at the head of the file and
// is named on the chapter, the way Massachusetts's parts are.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { elements, line } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const FILE = (n) => `https://www.oregonlegislature.gov/bills_laws/ors/ors${n}.html`
const CHAPTERS = Array.from({ length: 900 }, (_, i) => String(i + 1).padStart(3, "0"))

// "1.002 Supreme Court; Chief Justice as administrative head…" — a number, then
// the catchline, then, in the body but not the contents, the law itself.
const OPENS = /^(\d+[A-Za-z]?\.\d+[A-Za-z]?)\s+(.*)$/s

export default {
  id: "or-ors",
  name: "Oregon Legislative Counsel — the Oregon Revised Statutes",
  states: ["OR"],
  source: "https://www.oregonlegislature.gov/bills_laws/Pages/ORS.aspx",

  async *laws({ state, only, have, log }) {
    const wanted = CHAPTERS.filter((n) => (!only || `C${Number(n)}` === only.toUpperCase()) && !have?.has(`C${Number(n)}`))
    let at = 0
    const documents = await map(wanted, 10, async (n) => {
      const html = await fetchDoc(state, FILE(n), { notFound: null })
      at += 1
      if (at % 100 === 0) log(`${at}/${wanted.length} chapter numbers tried`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const html = documents[i]
      if (!html) continue
      const law = read(html, wanted[i])
      if (!law) {
        log(`✗ chapter ${Number(wanted[i])} — the file carries no section text`)
        continue
      }
      log(`C${Number(wanted[i])} · ${law.nodes.length - 1} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(html, n) {
  const number = String(Number(n))
  const paragraphs = [...elements(html, "p")].map((p) => line(p.inner).replace(/ /g, " ").trim()).filter(Boolean)
  if (!paragraphs.length) return null

  // The file opens with the title the chapter sits in, then the chapter's own
  // name, then the other chapters of that title, then the contents.
  const titleAt = paragraphs.findIndex((p) => /^TITLE\s+\d+/i.test(p))
  const titleName = titleAt >= 0 ? titleCase(paragraphs[titleAt + 1] ?? "") : null
  const own = paragraphs.find((p) => new RegExp(`^Chapter\\s+${number}\\b`, "i").test(p))
  const law_name = titleCase(String(own ?? "").replace(new RegExp(`^Chapter\\s+${number}\\.?\\s*`, "i"), "")) || `Chapter ${number}`

  // Where the contents end and the law begins: the first entry that carries
  // more than its own catchline — a catchline, a full stop, and then text.
  const body = paragraphs.findIndex((p) => {
    const m = OPENS.exec(p)
    return m && /\.\s+\S/.test(m[2]) && m[2].length > 40
  })
  if (body < 0) return null

  const nodes = [
    {
      location_id: "CHAPTER",
      doc_type: "CHAPTER",
      doc_level_id: number,
      title: [law_name, titleName].filter(Boolean).join(" — "),
      parent_location_id: null,
      depth: 0,
    },
  ]
  const seen = new Set(["CHAPTER"])
  let open = null
  let lines = []

  const close = () => {
    if (!open) return
    nodes.push({
      location_id: open.location_id,
      doc_type: "SECTION",
      doc_level_id: open.number,
      title: open.title,
      parent_location_id: "CHAPTER",
      depth: 1,
      repealed: /\brepealed\b/i.test([open.title, lines[0]].join(" ")),
      text: [`${open.number} ${open.title ?? ""}`.trim(), ...lines].filter(Boolean).join("\n\n") || null,
    })
    open = null
    lines = []
  }

  for (const paragraph of paragraphs.slice(body)) {
    const m = OPENS.exec(paragraph)
    if (m) {
      close()
      const location_id = unique(m[1], seen)
      seen.add(location_id)
      const rest = m[2].replace(/\s+/g, " ").trim()
      // A repealed or renumbered section has no catchline at all: Oregon
      // prints the note in its place, and the note is the entry rather than a
      // heading to put in a rail.
      const note = rest.startsWith("[")
      const cut = note ? null : /^(.*?\.)\s+(?=\S)/.exec(rest)
      open = { location_id, number: m[1], title: note ? null : (cut ? cut[1] : rest).replace(/\.$/, "") || null }
      lines = note ? [rest] : cut ? [rest.slice(cut[0].length).trim()] : []
      continue
    }
    if (open) lines.push(paragraph)
  }
  close()

  if (nodes.length < 2) return null
  return { law_id: `C${number}`, law_name, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
