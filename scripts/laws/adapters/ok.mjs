// Oklahoma — the Oklahoma Statutes, from the Legislature.
//
// The first route tried was the Oklahoma State Courts Network, which indexes
// every section and serves each as a document. Its index answers; its
// documents answer with a page asking the reader to verify they are human.
// That is the host refusing, and a machine is not going to answer it — so the
// Legislature's own publication is the route taken instead.
//
// `oklegislature.gov/OK_Statutes/CompleteTitles/os1.pdf` is a whole title, and
// `osstatuestitle.html` names every one of them with its size. Each PDF prints
// its contents first — one line per section, dot-leadered to a page number —
// and then the law, in the same shape; so a section number appears twice and
// the one carrying the words is the longer of the two.
//
// A law here is a title, which is how Oklahoma cites: "1 O.S. § 20" is section
// 20 of title 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { fetchPdf, prose } from "../lib/pdf.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const INDEX = "https://www.oklegislature.gov/osstatuestitle.html"

export default {
  id: "ok-legislature",
  name: "Oklahoma Legislature — the Oklahoma Statutes",
  states: ["OK"],
  source: "https://www.oklegislature.gov/osstatuestitle.html",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, INDEX)
    const titles = []
    for (const a of elements(index, "a")) {
      const m = /CompleteTitles\/os([0-9A-Za-z]+)\.pdf$/i.exec(attrs(a.head).href ?? "")
      if (!m || titles.some((t) => t.number === m[1])) continue
      titles.push({ number: m[1], url: attrs(a.head).href })
    }
    // The page names each title beside its link — "Title 3A. Amusements and
    // Sports (277KB)" — with the number and the name on separate lines.
    const lines = text(index).split("\n").map((l) => l.trim())
    const names = new Map()
    for (let i = 0; i < lines.length; i++) {
      const m = /^([0-9A-Za-z.]+)\.\s*(.*?)\s*(?:\(\d+KB\))?$/.exec(lines[i])
      if (m && /^Title$/i.test(lines[i - 1] ?? "")) names.set(m[1], titleCase(m[2].replace(/\s*\(See[^)]*\)\s*/i, "").trim()))
    }
    log(`${titles.length} titles`)

    const wanted = titles.filter((t) => (!only || `T${t.number}` === only.toUpperCase()) && !have?.has(`T${t.number}`))
    let at = 0
    const documents = await map(wanted, 6, async (t) => {
      const pdf = await fetchPdf(state, t.url, { notFound: null }).catch(() => null)
      at += 1
      if (at % 10 === 0) log(`${at}/${wanted.length} titles fetched`)
      return pdf
    })

    for (let i = 0; i < wanted.length; i++) {
      const raw = documents[i]
      if (!raw) {
        log(`✗ title ${wanted[i].number} — no document`)
        continue
      }
      const law = read(raw, wanted[i].number, names.get(wanted[i].number) ?? null)
      if (!law) {
        log(`· title ${wanted[i].number} — the file carries no section`)
        continue
      }
      log(`T${wanted[i].number} · ${law.nodes.length - 1} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(raw, number, name) {
  const words = prose(raw).replace(/\s+/g, " ").trim()
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = words.split(new RegExp(`(?=§${escaped}-[0-9A-Za-z.]+\\.)`, "g")).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  // The contents and the law are printed in the same shape; the contents lead
  // to a page number through a run of dots, and the law leads to the law.
  const best = new Map()
  for (const part of parts) {
    const m = new RegExp(`^§(${escaped}-[0-9A-Za-z.]+)\\.\\s*(.*)$`, "s").exec(part)
    if (!m) continue
    const clean = m[2].replace(/\.{4,}\s*\d+\s*$/, "").trim()
    const previous = best.get(m[1])
    if (!previous || clean.length > previous.rest.length) best.set(m[1], { rest: clean })
  }
  if (!best.size) return null

  const nodes = [
    { location_id: "TITLE", doc_type: "TITLE", doc_level_id: number, title: name, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["TITLE"])
  for (const [cite, { rest }] of best) {
    const location_id = unique(cite, seen)
    seen.add(location_id)
    const cut = /^(.{2,200}?\.)\s+(?=\S)/.exec(rest)
    nodes.push({
      location_id,
      doc_type: "SECTION",
      doc_level_id: cite,
      title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
      parent_location_id: "TITLE",
      depth: 1,
      repealed: /\brepealed\b/i.test(rest.slice(0, 120)),
      text: `§${cite}. ${rest}`.trim(),
    })
  }
  return { law_id: `T${number}`, law_name: name || `Title ${number}`, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
