// The United States Code, from the Office of the Law Revision Counsel.
//
// The OLRC publishes the whole Code as USLM XML at a release point — one file
// per title, updated as public laws are classified. USLM already carries the
// structure a reader wants, so nothing here has to infer a hierarchy from
// heading text: a <chapter> inside a <title>, a <section> inside that, and a
// <num> and <heading> on each.
//
// What is taken is the section's own content and the source credit the OLRC
// prints under it. The editorial notes are left where they are — they are the
// layer around the law rather than the law.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

import { cacheDir, download } from "../lib/fetch.mjs"
import { titleCase } from "../lib/text.mjs"
import { attrs, childText, endOf, plain, without } from "../lib/xml.mjs"

const RELEASE = process.env.USC_RELEASE || "119/103"
const BASE = `https://uscode.house.gov/download/releasepoints/us/pl/${RELEASE}`

// Titles 1-54, with the two that are published as an appendix of their own.
const TITLES = [
  ...Array.from({ length: 54 }, (_, i) => String(i + 1).padStart(2, "0")),
  "05a",
  "11a",
  "18a",
  "28a",
  "50a",
]

const name = (fragment) => {
  const heading = childText(fragment, "heading")
  // The Code prints its titles and chapters in capitals; its section catchlines
  // are already sentence case and are left alone by `titleCase`.
  return heading ? titleCase(heading.replace(/\s+/g, " ").trim()) : null
}
const number = (fragment) => {
  const num = childText(fragment, "num")
  if (!num) return null
  // "Title 1—", "CHAPTER 1—", "§ 1." — the label is the tree's job, not ours.
  return (
    num
      .replace(/^[^0-9A-Za-z]*(?:title|chapter|subchapter|part|subpart|subtitle|division|article|rule|§+)?\s*/i, "")
      // "Title 11—APPENDIX" is the appendix saying so twice; the name below it
      // already does.
      .replace(/[—-]\s*APPENDIX\s*$/i, "")
      .replace(/[—.\s]+$/, "")
      .trim() || null
  )
}

export default {
  id: "us-uslm",
  name: "Office of the Law Revision Counsel — United States Code (USLM)",
  states: ["US"],
  source: "https://uscode.house.gov/download/download.shtml",

  async *laws({ only, log }) {
    const dir = join(cacheDir, "usc", RELEASE.replace("/", "-"))
    mkdirSync(dir, { recursive: true })

    for (const t of TITLES) {
      const law_id = `USC${t.toUpperCase()}`
      if (only && law_id !== only.toUpperCase()) continue
      const file = join(dir, `usc${t}.xml`)
      if (!existsSync(file)) {
        const zip = await download(`${BASE}/xml_usc${t}@${RELEASE.replace("/", "-")}.zip`, `usc${t}-${RELEASE.replace("/", "-")}.zip`).catch(() => null)
        // A title that does not exist — 53 is reserved — is answered with an
        // error page and a 200, so the file is checked for being a ZIP rather
        // than trusted for having arrived.
        if (!zip || readFileSync(zip).subarray(0, 2).toString("latin1") !== "PK") {
          if (zip) rmSync(zip, { force: true })
          log(`· title ${t} — not published at this release point`)
          continue
        }
        execFileSync("unzip", ["-o", "-q", zip, "-d", dir])
        const written = readdirSync(dir).find((n) => n.toLowerCase() === `usc${t}.xml`)
        if (!written) {
          log(`✗ title ${t} — the archive held no usc${t}.xml`)
          continue
        }
      }
      const xml = readFileSync(file, "utf8")
      const law = read(xml, law_id, t)
      if (!law) {
        log(`✗ title ${t} — no <title> element`)
        continue
      }
      yield law
    }
  },
}

function read(source, law_id, t) {
  // Tables of contents repeat the tree as links, and notes are the layer
  // around the law. Neither is scanned, so neither can be mistaken for a
  // level or a section.
  const xml = without(source, ["toc", "notes"])
  // A title of the Code is a <title>. The five appendices are an <appendix>,
  // and four of them hold the Federal Rules of Procedure — court rules rather
  // than statutes, which is what New York's RULES type is for.
  //
  // Whichever opens first is the root, not whichever exists: the Federal Rules
  // of Criminal Procedure are arranged into titles *inside* the appendix, so
  // testing for <title> first named Title 18's appendix "Applicability".
  const titleFirst = xml.search(/<title(?=[\s>])/)
  const appendixFirst = xml.search(/<appendix(?=[\s>])/)
  if (titleFirst < 0 && appendixFirst < 0) return null
  const root = appendixFirst >= 0 && (titleFirst < 0 || appendixFirst < titleFirst) ? "appendix" : "title"
  const rules = /<courtRules(?=[\s>])/.test(xml)
  const titleAt = root === "appendix" ? appendixFirst : titleFirst
  const titleOpen = xml.indexOf(">", titleAt)
  const titleFragment = xml.slice(titleAt, endOf(xml, root, titleAt))
  const titleName = name(titleFragment) ?? `Title ${t}`
  const titleNumber = number(titleFragment) ?? t.replace(/^0/, "")

  const nodes = [
    { location_id: "TITLE", doc_type: "TITLE", doc_level_id: titleNumber, title: titleName, parent_location_id: null, depth: 0 },
  ]
  const seen = new Set(["TITLE"])
  const stack = [{ id: "TITLE", depth: 0 }]

  // One pass, left to right: every level pushes, every section is a leaf of
  // whatever level is open. The identifier attribute USLM puts on each element
  // is unique within the title, so it is the location.
  const tags = /<(\/?)(section|courtRules|courtRule|subtitle|division|subdivision|chapter|subchapter|part|subpart|article|subarticle|note|quotedContent)(?=[\s/>])/g
  tags.lastIndex = titleOpen
  let m
  while ((m = tags.exec(xml))) {
    const [, closing, tag] = m
    if (tag === "note" || tag === "quotedContent") {
      // A quoted amendment carries whole sections that are not in force here.
      tags.lastIndex = endOf(xml, tag, m.index)
      continue
    }
    if (closing) {
      while (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop()
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop()
      continue
    }
    const end = endOf(xml, tag, m.index)
    const openEnd = xml.indexOf(">", m.index)
    const head = xml.slice(m.index, openEnd + 1)
    const id = attrs(head).identifier || attrs(head).id
    const location_id = shorten(id) ?? `${tag}-${nodes.length}`
    if (seen.has(location_id)) {
      if (tag === "section" || tag === "courtRule") tags.lastIndex = end
      continue
    }

    if (tag === "section" || tag === "courtRule") {
      const fragment = xml.slice(m.index, end)
      const num = number(fragment)
      const heading = name(fragment)
      const body = plain(without(fragment, ["num", "heading", "toc"]))
      nodes.push({
        location_id,
        doc_type: tag === "courtRule" ? "RULE" : "SECTION",
        doc_level_id: num,
        title: heading,
        parent_location_id: stack[stack.length - 1].id,
        depth: stack[stack.length - 1].depth + 1,
        text: [num ? `${tag === "courtRule" ? "Rule" : "§"} ${num}. ${heading ?? ""}`.trim() : heading, body].filter(Boolean).join("\n\n") || null,
      })
      seen.add(location_id)
      tags.lastIndex = end
      continue
    }

    // A level. It stays open until its close tag, so the sections between
    // hang off it.
    const fragment = xml.slice(m.index, Math.min(end, m.index + 4000))
    nodes.push({
      location_id,
      doc_type: tag === "courtRules" ? "RULES" : tag.toUpperCase(),
      // A level with no number of its own writes an empty level id rather than
      // letting the browser fall back to printing its location.
      doc_level_id: number(fragment) ?? "",
      title: name(fragment),
      parent_location_id: stack[stack.length - 1].id,
      depth: stack[stack.length - 1].depth + 1,
    })
    seen.add(location_id)
    stack.push({ id: location_id, depth: stack[stack.length - 1].depth + 1, tag })
  }

  return {
    law_id,
    law_name: titleName.replace(/\s+/g, " "),
    law_type: rules ? "RULES" : "CONSOLIDATED",
    chapter: titleNumber,
    nodes,
  }
}

/** "/us/usc/t1/ch1/s2" → "ch1/s2", which is short, stable and unique in the title. */
function shorten(identifier) {
  if (!identifier) return null
  const rest = identifier
    .replace(/^\/us\/usc\/t[0-9a-zA-Z]+\/?/, "")
    .replace(/^\/us\/usc\//, "")
    .replace(/^\//, "")
  return rest || "TITLE"
}
