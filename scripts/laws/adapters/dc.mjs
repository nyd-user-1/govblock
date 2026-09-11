// The District of Columbia — the Code of the District of Columbia, from the
// Council's own XML.
//
// The Council publishes the Code as XML through the Open Law Library at
// github.com/DCCouncil/dc-law-xml-codified: one index per title, one file per
// section, and `xi:include` between them. The tree is the Council's own — a
// <container> carries its prefix ("Chapter", "Subchapter", "Part"), its number
// and its heading — so nothing here is inferred from heading text.
//
// **This is a snapshot, not a feed.** The repository was last published on
// 14 October 2021 and the Code in it is current through 7 October 2021, which
// the index.xml states itself. Every /laws page says which date its law is
// current to; the District's says 2021 because that is true. A reader who
// needs today's Code is one click from code.dccouncil.gov, which the page also
// links.
//
// The <annotations> block is the codification's editorial layer — Editor's
// Notes, Cross References, Prior Codifications — and is left where it is. The
// History annotation is taken, on the same terms as California's enacting line
// and the OLRC's source credit: it is the law's own provenance, not commentary
// on it.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { cacheDir, download } from "../lib/fetch.mjs"
import { children, plain, without } from "../lib/xml.mjs"

const ARCHIVE = "https://github.com/DCCouncil/dc-law-xml-codified/archive/refs/heads/master.tar.gz"
const KEY = "dc-code"

const KINDS = {
  title: "TITLE",
  subtitle: "SUBTITLE",
  division: "DIVISION",
  subdivision: "SUBDIVISION",
  chapter: "CHAPTER",
  subchapter: "SUBCHAPTER",
  part: "PART",
  subpart: "SUBPART",
  article: "ARTICLE",
  subarticle: "SUBARTICLE",
  unit: "UNIT",
}

/** DC ends every heading with a full stop; New York's and California's do not. */
const heading = (text) => (text ? String(text).trim().replace(/\.$/, "").trim() || null : null)

const first = (kids, tag) => kids.find((k) => k.tag === tag)

/** The indent a nested paragraph keeps, since the browser sets the text as it is given. */
const pad = (depth) => "    ".repeat(Math.max(0, depth))

/**
 * A section's body: its paragraphs in document order, each one its number, its
 * catchline and its words, indented by how deep it sits.
 */
function body(kids, depth, out) {
  let head = []
  for (const child of kids) {
    if (child.tag === "num" || child.tag === "heading") {
      head.push(plain(child.inner))
      continue
    }
    if (child.tag === "text") {
      out.push(pad(depth) + [...head, plain(child.inner)].filter(Boolean).join(" ").trim())
      head = []
      continue
    }
    if (child.tag === "para") {
      if (head.length) {
        out.push(pad(depth) + head.filter(Boolean).join(" ").trim())
        head = []
      }
      body(children(child.inner), depth + 1, out)
    }
  }
  if (head.length) out.push(pad(depth) + head.filter(Boolean).join(" ").trim())
}

/** The enacting history the Council prints under a section, and nothing else in the block. */
function history(fragment) {
  const block = children(fragment).find((k) => k.tag === "annotations")
  if (!block) return null
  const lines = children(block.inner)
    .filter((k) => k.tag === "annotation" && /type="History"/.test(k.head))
    .map((k) => plain(k.inner))
    .filter(Boolean)
  return lines.length ? `(${lines.join("; ")})` : null
}

export default {
  id: "dc-council-xml",
  name: "Council of the District of Columbia — D.C. Code (XML, 2021 snapshot)",
  states: ["DC"],
  source: "https://code.dccouncil.gov/",

  async *laws({ only, log }) {
    const root = await unpack(log)
    const code = join(root, "dc", "council", "code")
    const index = readFileSync(join(code, "index.xml"), "utf8")
    const through = /<recency[^>]*through="([\d-]+)"/.exec(index)?.[1] ?? null
    log(`the Council's XML, current through ${through ?? "an unstated date"}`)

    // The order the code's own index includes its titles in, which is the order
    // a reader reads them.
    const order = [...index.matchAll(/href="\.\/titles\/([^/]+)\/index\.xml"/g)].map((m) => m[1])
    const titles = order.length ? order : readdirSync(join(code, "titles"))

    for (const t of titles) {
      const law_id = `T${t.toUpperCase()}`
      if (only && law_id !== only.toUpperCase()) continue
      const file = join(code, "titles", t, "index.xml")
      if (!existsSync(file)) {
        log(`✗ title ${t} — no index.xml`)
        continue
      }
      const xml = readFileSync(file, "utf8")
      const container = children(xml).find((k) => k.tag === "container")
      if (!container) {
        log(`✗ title ${t} — no container`)
        continue
      }
      const kids = children(container.inner)
      const name = heading(plain(first(kids, "heading")?.inner ?? "")) ?? `Title ${t}`
      const num = plain(first(kids, "num")?.inner ?? "") || t

      const nodes = [{ location_id: "TITLE", doc_type: "TITLE", doc_level_id: num, title: name, parent_location_id: null, depth: 0 }]
      const seen = new Set(["TITLE"])
      let at = 0

      const walk = (list, parent, depth) => {
        for (const child of list) {
          if (child.tag === "container") {
            const own = children(child.inner)
            const prefix = plain(first(own, "prefix")?.inner ?? "").toLowerCase()
            const location_id = `n${(at += 1)}`
            nodes.push({
              location_id,
              doc_type: KINDS[prefix] ?? "PART",
              doc_level_id: plain(first(own, "num")?.inner ?? ""),
              title: heading(plain(first(own, "heading")?.inner ?? "")),
              parent_location_id: parent,
              depth,
            })
            walk(own, location_id, depth + 1)
            continue
          }
          if (child.tag === "xi:include") {
            const href = /href="([^"]+)"/.exec(child.head)?.[1]
            if (!href) continue
            const section = readSection(join(code, "titles", t, href.replace(/^\.\//, "")))
            if (!section || seen.has(section.location_id)) continue
            seen.add(section.location_id)
            nodes.push({ ...section, parent_location_id: parent, depth })
          }
        }
      }
      walk(kids, "TITLE", 1)

      yield {
        law_id,
        law_name: name,
        law_type: "CONSOLIDATED",
        chapter: num,
        nodes,
      }
    }
  },
}

function readSection(file) {
  if (!existsSync(file)) return null
  const xml = readFileSync(file, "utf8")
  const element = children(xml).find((k) => k.tag === "section")
  if (!element) return null
  const kids = children(without(element.inner, ["annotations"]))
  const num = plain(first(kids, "num")?.inner ?? "")
  if (!num) return null
  const name = heading(plain(first(kids, "heading")?.inner ?? ""))
  // The section's own number and catchline are the first of each; the rest of
  // the children are the law.
  const rest = []
  let seenNum = false
  let seenHeading = false
  for (const child of kids) {
    if (child.tag === "num" && !seenNum) {
      seenNum = true
      continue
    }
    if (child.tag === "heading" && !seenHeading) {
      seenHeading = true
      continue
    }
    rest.push(child)
  }
  const lines = []
  body(rest, 0, lines)
  const credit = history(element.inner)
  return {
    location_id: num,
    doc_type: "SECTION",
    doc_level_id: num,
    title: name,
    text: [`§ ${num}. ${name ?? ""}`.trim(), lines.filter(Boolean).join("\n\n"), credit].filter(Boolean).join("\n\n") || null,
  }
}

async function unpack(log) {
  const out = join(cacheDir, KEY)
  const inside = join(out, "dc-law-xml-codified-master")
  if (existsSync(join(inside, "dc", "council", "code", "index.xml"))) return inside
  log("fetching the Council's XML — one archive, not 23,000 files")
  const tar = await download(ARCHIVE, "dc-law-xml-codified.tar.gz")
  mkdirSync(out, { recursive: true })
  execFileSync("tar", ["xzf", tar, "-C", out])
  return inside
}
