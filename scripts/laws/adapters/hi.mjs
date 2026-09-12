// Hawaii — the Hawaii Revised Statutes, from the Legislative Reference Bureau.
//
// `capitol.hawaii.gov/hrscurrent/` is a plain directory listing: volumes, then
// a folder per chapter, then one file per section — `HRS_0001-0001.htm` is
// § 1-1 — plus a `HRS_0001-.htm` that is the chapter's own contents. So
// nothing has to be enumerated or guessed: the file system is the index.
//
// The ledger recorded Hawaii as refusing an unknown agent with a 403. It does
// not refuse this one; the user agent every loader here sends begins with
// `Mozilla/` and names who is asking, which is what that rule is testing for.
//
// The Attorney General opinions and case notes printed under a section are the
// Bureau's research layer; the section's own text and the session laws that
// made it are the law, and the two are separated by the Bureau's own headings.
//
// A law here is a chapter, which is what Hawaii cites: "HRS § 1-1" is section
// 1 of chapter 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.capitol.hawaii.gov"

// The headings the Bureau sets over its own research layer. Everything from
// the first of them to the end of the file is left where it is.
const RESEARCH = /^(Attorney General Opinions|Case Notes|Law Journals and Reviews|Cross References|Rules of Court|Revision Note|Previous|Note)$/i

export default {
  id: "hi-lrb",
  name: "Hawaii Legislative Reference Bureau — the Hawaii Revised Statutes",
  states: ["HI"],
  source: "https://www.capitol.hawaii.gov/hrscurrent/",

  async *laws({ state, only, have, log }) {
    const root = await fetchDoc(state, `${BASE}/hrscurrent/`)
    const volumes = [...new Set([...elements(root, "a")].map((a) => attrs(a.head).href ?? ""))].filter((h) =>
      /^\/hrscurrent\/Vol\d+[^/]*\/$/.test(h)
    )
    log(`${volumes.length} volumes`)

    const chapters = []
    for (const volume of volumes) {
      const listing = await fetchDoc(state, `${BASE}${volume}`, { notFound: null })
      for (const h of [...new Set([...elements(listing ?? "", "a")].map((a) => attrs(a.head).href ?? ""))]) {
        const m = new RegExp(`^${volume}(HRS([0-9A-Za-z]+))/$`).exec(h)
        if (!m || chapters.some((c) => c.folder === m[1])) continue
        chapters.push({ path: h, folder: m[1], number: m[2].replace(/^0+/, "") || m[2] })
      }
    }
    log(`${chapters.length} chapters`)

    const wanted = chapters.filter((c) => (!only || `C${c.number}` === only.toUpperCase()) && !have?.has(`C${c.number}`))
    let at = 0

    for (const chapter of wanted) {
      const listing = await fetchDoc(state, `${BASE}${chapter.path}`, { notFound: null })
      at += 1
      if (at % 100 === 0) log(`${at}/${wanted.length} chapters`)
      if (!listing) continue
      const files = [...new Set([...elements(listing, "a")].map((a) => attrs(a.head).href ?? ""))].filter((h) =>
        new RegExp(`^${chapter.path}HRS_[0-9A-Za-z]+-[0-9A-Za-z.]+\\.htm$`).test(h)
      )
      if (!files.length) continue

      // The chapter's own contents file names it; it is not a section.
      const contents = [...new Set([...elements(listing, "a")].map((a) => attrs(a.head).href ?? ""))].find((h) =>
        new RegExp(`^${chapter.path}HRS_[0-9A-Za-z]+-\\.htm$`).test(h)
      )
      const heading = contents ? await fetchDoc(state, `${BASE}${contents}`, { notFound: null }) : null
      const law_name = heading ? chapterName(heading, chapter.number) : null

      const bodies = await map(files, 12, (f) => fetchDoc(state, `${BASE}${f}`, { notFound: null }))

      const nodes = [
        {
          location_id: "CHAPTER",
          doc_type: "CHAPTER",
          doc_level_id: chapter.number,
          title: law_name,
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["CHAPTER"])
      for (let i = 0; i < files.length; i++) {
        const read = bodies[i] ? readSection(bodies[i]) : null
        if (!read) continue
        const location_id = unique(read.number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: read.number,
          title: read.title,
          parent_location_id: "CHAPTER",
          depth: 1,
          repealed: /\brepealed\b/i.test(read.title ?? ""),
          text: read.text,
        })
      }
      if (nodes.length < 2) continue

      log(`C${chapter.number} · ${nodes.length - 1} sections · ${law_name ?? ""}`)
      yield {
        law_id: `C${chapter.number}`,
        law_name: law_name || `Chapter ${chapter.number}`,
        law_type: "CONSOLIDATED",
        chapter: chapter.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

/** A chapter's name, from the "CHAPTER 1 / COMMON LAW…" heading of its contents. */
function chapterName(html, number) {
  const lines = text(html).split("\n").map((l) => l.trim())
  const at = lines.findIndex((l) => new RegExp(`^CHAPTER\\s+${number}$`, "i").test(l))
  if (at < 0) return null
  const name = []
  for (let i = at + 1; i < lines.length && name.length < 3; i++) {
    if (!lines[i]) continue
    if (/^Section$/i.test(lines[i])) break
    name.push(lines[i])
  }
  return titleCase(name.join(" ")) || null
}

/** One section file: its number, its catchline, and the law before the notes. */
function readSection(html) {
  const whole = text(html)
  const m = /^§+\s*([0-9A-Za-z]+-[0-9A-Za-z.]+)\s*(.*)$/s.exec(whole)
  if (!m) return null
  const lines = whole.split("\n")
  const stop = lines.findIndex((l) => RESEARCH.test(l.trim()))
  const body = (stop > 0 ? lines.slice(0, stop) : lines).join("\n").trim()
  const first = m[2].replace(/\s+/g, " ").trim()
  const cut = /^(.{2,160}?\.)\s+(?=\S)/.exec(first)
  return {
    number: m[1],
    title: titleCase((cut ? cut[1] : first.split(".")[0]).replace(/\.$/, "")) || null,
    text: body || null,
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
