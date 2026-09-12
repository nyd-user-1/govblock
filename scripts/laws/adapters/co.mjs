// Colorado — the Colorado Revised Statutes, from the Office of Legislative
// Legal Services.
//
// The Office publishes the whole Code as one archive: `crs2026-htm.zip`, 37 MB,
// one file per title, and the state is a single download. The ledger had
// Colorado down as PDF-per-title behind LexisNexis's printing; the Office's
// own HTML is better than that and is what is taken.
//
// The files are a word processor's export in windows-1252, and the Office runs
// the whole of a title together: the title's contents first, then its parts and
// sections, each opening on its own number — "1-1-101. Short title." — and
// running to the next. The Source line under a section is the law's own
// provenance and is kept; the editor's notes and annotations beside it are the
// Office's research layer and are left.
//
// A law here is a title, which is how Colorado cites: "C.R.S. § 1-1-101" is
// title 1, article 1, section 101.
import { directory, entry } from "../lib/remote-zip.mjs"
import { inOrder } from "../lib/tree.mjs"
import { text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const ARCHIVE = process.env.CO_CRS_ZIP || "https://olls.info/crs/crs2026-htm.zip"
const KEY = "co-crs"

// Where the Office stops printing the law and starts printing about it. The
// Source line is the section's own provenance and stays with it, the way
// California's enacting line and the OLRC's source credit do; what follows is
// the Office's research layer.
const NOTES = /(?:^|\s)(Editor's note:|Cross references:|ANNOTATION|Law reviews:|Annotator's note:)/i

export default {
  id: "co-olls",
  name: "Colorado Office of Legislative Legal Services — the Colorado Revised Statutes",
  states: ["CO"],
  source: "https://leg.colorado.gov/agencies/office-legislative-legal-services/colorado-revised-statutes",

  async *laws({ state, only, have, log }) {
    log(`reading the archive's directory — ${ARCHIVE}`)
    const { entries } = await directory(ARCHIVE)
    const titles = entries
      .map((e) => ({ entry: e, number: /title-([0-9A-Za-z]+)\.htm$/i.exec(e.name)?.[1] }))
      .filter((t) => t.number)
    log(`${titles.length} titles`)

    for (const title of titles) {
      const number = String(Number(title.number))
      const law_id = `T${number}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const bytes = await entry(ARCHIVE, title.entry, KEY)
      const whole = text(new TextDecoder("windows-1252").decode(bytes))
      const law = read(whole, number)
      if (!law) {
        log(`· title ${number} — the file carries no section`)
        continue
      }
      log(`${law_id} · ${law.nodes.length - 1} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(whole, number) {
  const flat = whole.replace(/\s+/g, " ").trim()
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Every place a section of this title opens. Colorado numbers articles with
  // decimals — "1-1.5-101" — so the article part is taken loosely.
  const opens = new RegExp(`(?=\\b${escaped}-[0-9A-Za-z.]+-[0-9A-Za-z.]+\\.\\s)`, "g")
  const parts = flat.split(opens).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const heading = whole.split("\n").map((l) => l.trim()).filter(Boolean)
  const at = heading.findIndex((l) => /^TITLE$/i.test(l) || new RegExp(`^TITLE\\s+${escaped}$`, "i").test(l))
  const law_name = titleCase(heading.slice(at + 1, at + 4).find((l) => /^[A-Z][A-Z ,'&-]{2,}$/.test(l)) ?? "") || `Title ${number}`

  // The title prints its contents before its text, so a number appears twice
  // and the one carrying the law is the longer of them.
  const best = new Map()
  for (const part of parts) {
    const m = new RegExp(`^(${escaped}-[0-9A-Za-z.]+-[0-9A-Za-z.]+)\\.\\s+(.*)$`, "s").exec(part)
    if (!m) continue
    const previous = best.get(m[1])
    if (!previous || m[2].length > previous.rest.length) best.set(m[1], { rest: m[2] })
  }
  if (!best.size) return null

  const nodes = [
    { location_id: "TITLE", doc_type: "TITLE", doc_level_id: number, title: law_name, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["TITLE"])
  // The article a section belongs to is the middle of its own number, which is
  // the only level Colorado's files mark reliably.
  const articles = new Map()

  for (const [cite, { rest }] of best) {
    const article = cite.split("-")[1]
    if (!articles.has(article)) {
      const id = `a${article}`
      articles.set(article, id)
      seen.add(id)
      nodes.push({ location_id: id, doc_type: "ARTICLE", doc_level_id: article, title: null, parent_location_id: "TITLE", depth: 1 })
    }
    const location_id = unique(cite, seen)
    seen.add(location_id)
    const cut = /^(.{2,200}?\.)\s+(?=\S)/.exec(rest)
    // The law runs to the first of the Office's own notes.
    const stop = rest.search(NOTES)
    nodes.push({
      location_id,
      doc_type: "SECTION",
      doc_level_id: cite,
      title: titleCase((cut ? cut[1] : rest.slice(0, 200)).replace(/\.$/, "")) || null,
      parent_location_id: articles.get(article),
      depth: 2,
      repealed: /\brepealed\b/i.test(rest.slice(0, 120)),
      text: `${cite}. ${stop > 0 ? rest.slice(0, stop) : rest}`.trim(),
    })
  }
  return { law_id: `T${number}`, law_name, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
