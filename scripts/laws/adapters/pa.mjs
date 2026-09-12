// Pennsylvania — the Consolidated Statutes, from the Legislative Reference
// Bureau.
//
// `legis.state.pa.us/WU01/LI/LI/CT/HTM/<t>/<t>.HTM` is a whole title in one
// file — Title 18, Crimes and Offenses, is 4.7 MB of it — and the Bureau
// leaves a machine-readable marker before every unit:
//
//   <div class="Comment">18cc</div>      the title's table of contents
//   <div class="Comment">18c101h</div>   a chapter heading, named by its first section
//   <div class="Comment">18c101s</div>   § 101, the words of the law
//   <div class="Comment">18c102v</div>   the Bureau's notes under § 102
//
// so nothing here has to infer a boundary from typography: the markers are the
// boundaries. Seventy files and the state is done.
//
// The notes are the Bureau's own — enactment, amendment, cross references —
// and Pennsylvania has no vendor between its legislature and its readers, so
// they are taken with the section rather than left behind. What is left is the
// table of contents, which the tree already is.
//
// **This is the Consolidated Statutes.** Pennsylvania is still consolidating,
// and the titles that have not been reached yet remain as unconsolidated
// session law; those are a second pass and are noted in the ledger.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const FILE = (t) => `https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/${t}/${t}.HTM`

// Titles 1 to 84; the ones Pennsylvania has not consolidated answer with a 404
// and are skipped by their own absence rather than by a list kept here.
const TITLES = Array.from({ length: 84 }, (_, i) => String(i + 1).padStart(2, "0"))

const KINDS = { CHAPTER: "CHAPTER", SUBCHAPTER: "SUBCHAPTER", PART: "PART", SUBPART: "SUBPART", ARTICLE: "ARTICLE", DIVISION: "DIVISION", SUBTITLE: "SUBTITLE" }

export default {
  id: "pa-lrb",
  name: "Pennsylvania Legislative Reference Bureau — the Consolidated Statutes",
  states: ["PA"],
  source: "https://www.legis.state.pa.us/cfdocs/legis/LI/Public/cons_index.cfm",

  async *laws({ state, only, have, log }) {
    const wanted = TITLES.filter((t) => (!only || `T${Number(t)}` === only.toUpperCase()) && !have?.has(`T${Number(t)}`))
    let at = 0
    const documents = await map(wanted, 6, async (t) => {
      const html = await fetchDoc(state, FILE(t), { notFound: null })
      at += 1
      if (at % 10 === 0) log(`${at}/${wanted.length} titles fetched`)
      return html
    })

    for (let i = 0; i < wanted.length; i++) {
      const t = wanted[i]
      const html = documents[i]
      if (!html) continue
      const law = read(html, t)
      if (!law) {
        log(`· title ${Number(t)} — not consolidated`)
        continue
      }
      log(`T${Number(t)} · ${law.nodes.filter((n) => n.doc_type === "SECTION").length.toLocaleString("en-US")} sections · ${law.law_name}`)
      yield law
    }
  },
}

/** Every marked unit of a title, in the order the Bureau prints them. */
function* units(html) {
  const marker = /<div class="Comment">([^<]*)<\/div>/g
  let m
  let previous = null
  while ((m = marker.exec(html))) {
    if (previous) yield { ...previous, body: html.slice(previous.from, m.index) }
    previous = { name: m[1].trim(), from: m.index + m[0].length }
  }
  if (previous) yield { ...previous, body: html.slice(previous.from) }
}

function read(html, t) {
  const number = String(Number(t))
  const all = [...units(html)]
  const contents = all.find((u) => /^\d+cc$/.test(u.name))
  if (!contents) return null

  // The title's own name is the second centred line of its contents, under
  // "TITLE 18".
  const heading = text(contents.body).split("\n").map((l) => l.trim()).filter(Boolean)
  const at = heading.findIndex((l) => new RegExp(`^TITLE\\s+${number}$`, "i").test(l))
  const law_name = titleCase(at >= 0 ? (heading[at + 1] ?? "") : "") || `Title ${number}`

  const nodes = [
    { location_id: "TITLE", doc_type: "TITLE", doc_level_id: number, title: law_name, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["TITLE"])
  // The levels currently open, innermost last, so a subchapter hangs off its
  // chapter and a chapter off whatever part it is in.
  let stack = [{ id: "TITLE", rank: 0 }]
  let last = null

  const RANK = { PART: 1, SUBPART: 2, SUBTITLE: 1, DIVISION: 3, ARTICLE: 3, CHAPTER: 4, SUBCHAPTER: 5 }

  for (const unit of all) {
    const kind = /^\d+c[\d.]+([hsv])$/.exec(unit.name)?.[1]
    if (!kind) continue

    if (kind === "h") {
      // A heading block prints the levels it opens, then the list of sections
      // under them, which the tree already carries.
      for (const heading of headingsIn(unit.body)) {
        while (stack.length > 1 && RANK[stack[stack.length - 1].kind] >= RANK[heading.doc_type]) stack.pop()
        const location_id = unique(`${heading.doc_type.toLowerCase()}-${heading.doc_level_id}`, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: heading.doc_type,
          doc_level_id: heading.doc_level_id,
          title: heading.title,
          parent_location_id: stack[stack.length - 1].id,
          depth: 0,
        })
        stack.push({ id: location_id, kind: heading.doc_type })
      }
      continue
    }

    if (kind === "s") {
      const words = text(unit.body)
      const opening = /^§+\s*([0-9A-Za-z][0-9A-Za-z.-]*)\.\s*(.*)$/s.exec(words.split("\n")[0] ?? "")
      if (!opening) continue
      const location_id = unique(opening[1], seen)
      seen.add(location_id)
      last = {
        location_id,
        doc_type: "SECTION",
        doc_level_id: opening[1],
        title: titleCase(opening[2].replace(/\.$/, "")) || null,
        parent_location_id: stack[stack.length - 1].id,
        depth: 0,
        repealed: /\brepealed\b/i.test(opening[2]),
        text: words,
      }
      nodes.push(last)
      continue
    }

    // A notes block belongs to the section above it.
    if (kind === "v" && last) {
      const notes = text(unit.body)
      if (notes) last.text = `${last.text}\n\n${notes}`
    }
  }

  if (!nodes.some((n) => n.doc_type === "SECTION")) return null
  return { law_id: `T${number}`, law_name, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
}

/**
 * The levels a heading block opens. Pennsylvania sets each as a centred line
 * naming the kind and its number, with the level's own name on the line under
 * it — "CHAPTER 1" then "GENERAL PROVISIONS".
 */
function* headingsIn(body) {
  const lines = text(body).split("\n").map((l) => l.replace(/\s+/g, " ").trim())
  for (let i = 0; i < lines.length; i++) {
    const m = /^(PART|SUBPART|SUBTITLE|DIVISION|ARTICLE|CHAPTER|SUBCHAPTER)\s+([0-9A-Za-z.-]+?)\.?$/i.exec(lines[i])
    if (!m || !KINDS[m[1].toUpperCase()]) continue
    const name = lines[i + 1] && !/^Sec\.?$/i.test(lines[i + 1]) ? lines[i + 1] : ""
    yield { doc_type: KINDS[m[1].toUpperCase()], doc_level_id: m[2], title: titleCase(name.replace(/\.$/, "")) || null }
    i += name ? 1 : 0
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
