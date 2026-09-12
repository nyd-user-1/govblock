// Louisiana — the Revised Statutes and the codes, from the Legislature.
//
// `legis.la.gov`'s table of contents navigates by ASP.NET postbacks, so no
// address addresses a title or a chapter and the tree cannot be walked. One
// thing is addressable: `Law.aspx?d=<id>`, which is one section, and the page
// names its own citation — "RS 13:916" — above its heading and its text.
//
// So the tree is rebuilt from the documents rather than walked: the ids are
// enumerated, each document says which code and title it belongs to, and the
// laws are assembled from that. The ids run from about 70,000 to 210,000 and
// are sparse; a number Louisiana does not use answers with the page and no
// citation, which is a gap.
//
// The Administrative Code shares the same document store and is not the
// standing law of the state, so `LAC` citations are left where they are.
//
// A law here is a title of a code, which is how Louisiana cites: "La. R.S.
// 13:916" is title 13 of the Revised Statutes, section 916.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { elements, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const DOC = (d) => `https://www.legis.la.gov/Legis/Law.aspx?d=${d}`

const FROM = Number(process.env.LA_FROM ?? 1)
const TO = Number(process.env.LA_TO ?? 230000)

// The codes Louisiana publishes here. `LAC` is the Administrative Code and is
// not one of them.
const CODES = {
  RS: "Revised Statutes",
  CC: "Civil Code",
  CCP: "Code of Civil Procedure",
  CCRP: "Code of Criminal Procedure",
  CE: "Code of Evidence",
  CHC: "Children's Code",
  CONST: "Constitution",
  "CONST-AN": "Constitution Ancillaries",
}

export default {
  id: "la-legis",
  name: "Louisiana Legislature — the Revised Statutes and codes",
  states: ["LA"],
  source: "https://www.legis.la.gov/legis/LawsContents.aspx",

  async *laws({ state, only, have, log }) {
    const ids = []
    for (let d = FROM; d <= TO; d++) ids.push(d)
    log(`${ids.length.toLocaleString("en-US")} document numbers to try`)

    // Every document, read into the law it says it belongs to.
    const found = new Map()
    let at = 0
    let kept = 0
    await map(ids, 16, async (d) => {
      const html = await fetchDoc(state, DOC(d), { notFound: null })
      at += 1
      if (at % 5000 === 0) log(`${at.toLocaleString("en-US")}/${ids.length.toLocaleString("en-US")} tried · ${kept.toLocaleString("en-US")} sections`)
      if (!html) return
      const section = read(html)
      if (!section) return
      if (!found.has(section.law_id)) found.set(section.law_id, [])
      found.get(section.law_id).push(section)
      kept += 1
    })
    log(`${found.size} laws · ${kept.toLocaleString("en-US")} sections`)

    for (const [law_id, sections] of [...found.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue
      sections.sort((a, b) => byNumber(a.number, b.number))

      const code = sections[0].code
      const title = sections[0].title
      const law_name = [CODES[code] ?? code, title ? `Title ${title}` : null].filter(Boolean).join(" — ")
      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: title ?? code, title: law_name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      for (const section of sections) {
        const location_id = unique(section.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: section.number,
          title: section.name,
          parent_location_id: "TITLE",
          depth: 1,
          repealed: /\brepealed\b/i.test(section.name ?? ""),
          text: section.text,
        })
      }
      log(`${law_id} · ${sections.length.toLocaleString("en-US")} sections · ${law_name}`)
      yield { law_id, law_name, law_type: code === "CONST" ? "MISC" : "CONSOLIDATED", chapter: title ?? null, nodes: inOrder(nodes) }
    }
  },
}

/** One document: its citation, its heading, and the law under them. */
function read(html) {
  const block = [...elements(html, "div", /id=["']ctl00_PageBody_divLaw["']/)][0]
  if (!block) return null
  const words = text(block.inner).trim()
  if (!words) return null
  const lines = words.split("\n").map((l) => l.trim()).filter(Boolean)
  // "RS 13:916" — the code, then the title and the section within it.
  const m = /^([A-Z][A-Z-]{1,7})\s+([0-9A-Za-z]+):([0-9A-Za-z.:-]+)$/.exec(lines[0] ?? "")
  if (!m) return null
  const code = m[1].toUpperCase()
  if (!CODES[code]) return null
  const heading = lines[1] ?? ""
  const named = /^§+\s*[0-9A-Za-z.:-]+\.?\s*(.*)$/.exec(heading)
  return {
    law_id: `${code}${m[2]}`,
    code,
    title: m[2],
    number: `${m[2]}:${m[3]}`,
    name: titleCase((named ? named[1] : heading).replace(/\.$/, "")) || null,
    text: words,
  }
}

/** "13:916" before "13:1000" — the parts compared as numbers where they are. */
function byNumber(a, b) {
  const parts = (n) => n.split(/[:.]/).map((p) => (/^\d+$/.test(p) ? Number(p) : p))
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const l = x[i]
    const r = y[i]
    if (l === undefined) return -1
    if (r === undefined) return 1
    if (l === r) continue
    if (typeof l === "number" && typeof r === "number") return l - r
    return String(l) < String(r) ? -1 : 1
  }
  return 0
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
