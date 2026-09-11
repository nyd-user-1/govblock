// California — the twenty-nine codes, from the Legislative Counsel's own
// bulk publication.
//
// leginfo publishes the whole session as pubinfo_<year>.zip: every bill, every
// vote, every lobbying filing, and the codes. The codes are three tab-delimited
// tables inside it —
//
//   LAW_TOC_TBL           the hierarchy: division, part, title, chapter, article
//   LAW_TOC_SECTIONS_TBL  one row per section, hung off a node of that hierarchy
//   LAW_SECTION_TBL       one row per section, its text in a file of its own
//
// and the tree is already drawn for us: NODE_TREEPATH is a dotted path, so a
// node's parent is its path less the last segment. No inference, no guessing
// from heading text.
//
// The section texts are 162,432 separate entries scattered through 1.24 GB of
// bill files, so they are read by range rather than by pulling the archive —
// 89 MB instead of 1,280 MB, which is the difference between being a good
// citizen and not.
//
// No vendor sits in front of California and nothing here is anyone's
// annotation: the heading, the section number, the text, and the enacting
// history line the Legislative Counsel publishes with each section.
import { directory, entry, manyEntries } from "../lib/remote-zip.mjs"
import { titleCase } from "../lib/text.mjs"

const YEAR = 2025
const URL = `https://downloads.leginfo.legislature.ca.gov/pubinfo_${YEAR}.zip`
const KEY = `ca-${YEAR}`

/** The .dat files quote text fields in backticks and separate with tabs. */
const cell = (v) => {
  if (v === undefined) return null
  const s = v.trim()
  if (s === "NULL" || s === "") return null
  return s.startsWith("`") && s.endsWith("`") ? s.slice(1, -1) : s
}
const rows = (buffer) =>
  buffer
    .toString("utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split("\t").map(cell))

// A heading is "CHAPTER 25.1. Transparency in Frontier Artificial Intelligence
// Act [22757.10. - 22757.16.]" — the kind, the number, the name, and the span
// of sections it holds. The span is repeated by the tree itself, so it goes.
const KINDS = ["DIVISION", "SUBDIVISION", "PART", "TITLE", "SUBTITLE", "CHAPTER", "SUBCHAPTER", "ARTICLE", "SUBARTICLE"]
function readHeading(heading) {
  const clean = String(heading ?? "").replace(/\s*\[[^\]]*\]\s*$/, "").trim()
  const kind = KINDS.find((k) => clean.toUpperCase().startsWith(k + " "))
  // Fifty-three of California's 24,386 headings are unnumbered front matter —
  // "GENERAL PROVISIONS", the Constitution's preamble. New York writes an
  // empty level id for the same thing, so these do too.
  if (!kind) {
    const preamble = /^PREAMBLE\b/i.test(clean)
    return { doc_type: preamble ? "PREAMBLE" : "PART", doc_level_id: "", title: titleCase(clean.replace(/^PREAMBLE:?\s*/i, "")) || null }
  }
  const after = clean.slice(kind.length).trim()
  const number = /^([0-9A-Za-z.]+?)\.?(?=\s|$)/.exec(after)
  const level = number ? number[1] : ""
  const title = after.slice(number ? number[0].length : 0).replace(/^\s*[.:]?\s*/, "").trim()
  return { doc_type: kind, doc_level_id: level, title: titleCase(title) || null }
}

// CAML is the Legislative Counsel's own markup: paragraphs, and an en-space
// where the printed code indents. Set as prose, because the law is prose.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", sect: "§", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", deg: "°" }
function readContent(xml) {
  // The paragraph break is marked before anything is stripped: the source also
  // hard-wraps and indents inside a paragraph for its own printing, and those
  // newlines are not breaks a reader should see.
  const BREAK = "\u0001"
  let text = String(xml)
    .replace(/<caml:Content[^>]*>/g, "")
    .replace(/<\/caml:Content>/g, "")
    .replace(/<span[^>]*class="EnSpace"[^>]*\/?>/g, " ")
    .replace(/<\/p>\s*<p[^>]*>/g, BREAK)
    .replace(/<br\s*\/?>/g, BREAK)
    .replace(/<[^>]+>/g, "")
  text = text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name) => {
    if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(parseInt(name.slice(2), 16))
    if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)))
    return ENTITIES[name] ?? whole
  })
  return text
    .split(BREAK)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

export default {
  id: "ca-pubinfo",
  name: "California Legislative Counsel — leginfo bulk (pubinfo)",
  states: ["CA"],
  source: URL,

  async *laws({ only, log }) {
    log(`reading the archive's directory — ${URL}`)
    const { entries: all } = await directory(URL)
    const find = (name) => all.find((e) => e.name === name)

    const codes = rows(await entry(URL, find("CODES_TBL.dat"), KEY))
    const toc = rows(await entry(URL, find("LAW_TOC_TBL.dat"), KEY))
    const tocSections = rows(await entry(URL, find("LAW_TOC_SECTIONS_TBL.dat"), KEY))
    const sections = rows(await entry(URL, find("LAW_SECTION_TBL.dat"), KEY))
    log(`${codes.length} codes · ${toc.length} headings · ${tocSections.length} sections`)

    // Which .lob holds each section's text, and its enacting history.
    const lobOf = new Map()
    const historyOf = new Map()
    for (const row of sections) {
      if (!row[0]) continue
      if (row[15] === "N") continue
      lobOf.set(row[0], row[14])
      historyOf.set(row[0], row[13])
    }

    const wanted = only ? codes.filter((c) => c[0] === only) : codes
    const needed = new Set()
    for (const [id] of wanted)
      for (const row of tocSections) if (row[1] === id && lobOf.get(row[0])) needed.add(lobOf.get(row[0]))
    log(`fetching ${needed.size.toLocaleString("en-US")} section texts by range`)
    const records = all.filter((e) => needed.has(e.name))
    const texts = await manyEntries(URL, records, KEY, (done, total) => {
      if (done % 6000 === 0 || done === total) log(`  ${done.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}`)
    })

    for (const [id, name] of wanted) {
      // "Business and Professions Code - BPC" → "Business and Professions".
      const law_name = titleCase(String(name).replace(/\s*-\s*[A-Z]+$/, "").replace(/\s+Code$/, "").trim())
      const nodes = [{ location_id: "CODE", doc_type: "CODE", doc_level_id: id, title: `${titleCase(law_name)} Code`, parent_location_id: null, depth: 0 }]

      const headings = toc.filter((r) => r[0] === id).sort((a, b) => Number(a[10]) - Number(b[10]))
      const paths = new Set(headings.map((r) => r[13]))
      for (const row of headings) {
        const path = row[13]
        const cut = String(path).lastIndexOf(".")
        const parent = cut > 0 ? String(path).slice(0, cut) : null
        const { doc_type, doc_level_id, title } = readHeading(row[6])
        nodes.push({
          location_id: `t${path}`,
          doc_type,
          doc_level_id,
          title,
          // A path whose parent is not itself a heading hangs off the code.
          parent_location_id: parent && paths.has(parent) ? `t${parent}` : "CODE",
          depth: Number(row[11]) || 1,
        })
      }

      const mine = tocSections.filter((r) => r[1] === id).sort((a, b) => Number(a[12] ?? a[4]) - Number(b[12] ?? b[4]))
      const seen = new Set()
      for (const row of mine) {
        const lob = lobOf.get(row[0])
        const xml = lob ? texts.get(lob) : null
        const number = String(row[3] ?? "").replace(/\.$/, "")
        if (!number || seen.has(number)) continue
        seen.add(number)
        const body = xml ? readContent(xml.toString("utf8")) : ""
        const history = historyOf.get(row[0])
        nodes.push({
          location_id: number,
          doc_type: "SECTION",
          doc_level_id: number,
          title: null,
          parent_location_id: paths.has(row[2]) ? `t${row[2]}` : "CODE",
          depth: (Number(headings.find((h) => h[13] === row[2])?.[11]) || 0) + 1,
          text: [`${number}. ${body}`.trim(), history ? `(${history.trim()})` : null].filter(Boolean).join("\n\n"),
        })
      }

      // Document order: the code, then every heading and its sections in the
      // order the tree puts them, so `?text=1` reads the way the code reads.
      yield {
        law_id: id,
        law_name,
        law_type: "CONSOLIDATED",
        chapter: null,
        nodes: inOrder(nodes),
      }
    }
  },
}

/** Depth-first from the root, so sequence_no is reading order rather than table order. */
function inOrder(nodes) {
  const children = new Map()
  for (const node of nodes) {
    const key = node.parent_location_id ?? ""
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(node)
  }
  const out = []
  const walk = (id, depth) => {
    for (const node of children.get(id) ?? []) {
      out.push({ ...node, depth })
      walk(node.location_id, depth + 1)
    }
  }
  const root = nodes.find((n) => !n.parent_location_id)
  out.push({ ...root, depth: 0 })
  walk(root.location_id, 1)
  return out
}
