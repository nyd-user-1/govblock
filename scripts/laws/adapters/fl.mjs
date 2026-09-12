// Florida — the Florida Statutes, from the Senate.
//
// `flsenate.gov` renders the statutes from the Legislature's own XML and keeps
// the XML's class names in the HTML, so the page is as good as the markup
// underneath it: a `<div class="Section">` holds a `SectionNumber`, a
// `CatchlineText`, a `SectionBody` of nested `Subsection` and `Paragraph`
// divs each with its own `Number`, and a `History` block at the end. Nothing
// here has to guess a hierarchy out of indentation.
//
// The whole of a chapter comes back from one request — `/ChapterN/All` — so
// Florida is four hundred documents rather than fifty thousand.
//
// A law here is a title, which is how the Statutes are arranged and how the
// United States Code and the District are held in this table. Chapters and
// parts are levels inside it; the citation a reader knows, "§ 316.193, Fla.
// Stat.", is the section's own number and is its location.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.flsenate.gov/Laws/Statutes"
const YEAR = process.env.FL_STATUTES_YEAR || "2025"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

/** The first element of a class inside a fragment, as one line of prose. */
function first(html, tag, name) {
  for (const e of elements(html, tag, cls(name))) return line(e.inner)
  return null
}

export default {
  id: "fl-senate",
  name: "Florida Senate — the Florida Statutes",
  states: ["FL"],
  source: "https://www.flsenate.gov/Laws/Statutes",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/${YEAR}`)
    // The table of contents names every title; opening one renders the same
    // page with that title's chapters listed under it.
    const titles = []
    for (const li of elements(index, "li")) {
      const m = /href="\/Laws\/Statutes\/[^/]+\/Title(\d+)\//.exec(li.inner)
      if (!m || titles.some((t) => t.number === m[1])) continue
      titles.push({
        number: m[1],
        roman: first(li.inner, "span", "title")?.replace(/^Title\s+/i, "") ?? m[1],
        name: titleCase(first(li.inner, "span", "descript") ?? ""),
      })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const law_id = `T${title.number}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const page = await fetchDoc(state, `${BASE}/${YEAR}/Title${title.number}`)
      // Only the open title lists its chapters; the rest are one link each.
      const from = page.indexOf(`id="Title${title.number}"`)
      const next = page.indexOf(`id="Title`, from + 1)
      const open = page.slice(from, next < 0 ? undefined : next)
      const chapters = []
      for (const a of elements(open, "a")) {
        const m = /\/Laws\/Statutes\/[^/]+\/Chapter([0-9A-Za-z]+)"/.exec(a.head)
        if (!m || chapters.some((c) => c.number === m[1])) continue
        chapters.push({ number: m[1], name: titleCase(first(a.inner, "span", "chDescript")?.replace(/^-\s*/, "") ?? "") })
      }
      if (!chapters.length) {
        log(`✗ ${law_id} — the contents list no chapters under Title ${title.roman}`)
        continue
      }

      const documents = await map(chapters, 12, (chapter) =>
        fetchDoc(state, `${BASE}/${YEAR}/Chapter${chapter.number}/All`, { notFound: null })
      )

      const nodes = [
        {
          location_id: "TITLE",
          doc_type: "TITLE",
          doc_level_id: title.roman,
          title: title.name || `Title ${title.roman}`,
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["TITLE"])
      let sections = 0

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const chapterId = `ch${chapter.number}`
        nodes.push({
          location_id: chapterId,
          doc_type: "CHAPTER",
          doc_level_id: chapter.number,
          title: chapter.name || null,
          parent_location_id: "TITLE",
          depth: 1,
        })
        seen.add(chapterId)
        const html = documents[i]
        if (!html) {
          log(`✗ ${law_id} chapter ${chapter.number} — no document`)
          continue
        }
        for (const node of readChapter(html, chapterId, seen)) {
          nodes.push(node)
          seen.add(node.location_id)
          if (node.doc_type === "SECTION") sections += 1
        }
      }

      log(`${law_id} · ${chapters.length} chapters · ${sections.toLocaleString("en-US")} sections`)
      yield {
        law_id,
        law_name: title.name || `Title ${title.roman}`,
        law_type: "CONSOLIDATED",
        chapter: null,
        nodes: inOrder(nodes),
      }
    }
  },
}

/**
 * One chapter document: its parts, if it has them, and its sections.
 *
 * The `PartIndex` at the top of a chapter is the chapter's own table of
 * contents and is skipped — the parts themselves follow it, each holding the
 * sections that belong to it.
 */
function* readChapter(html, chapterId, seen) {
  const body = html.slice(html.indexOf("<body"))
  const parts = [...elements(body, "div", cls("Part"))].filter((p) => !cls("PartIndex").test(p.head))
  if (!parts.length) {
    yield* readSections(body, chapterId, 2, seen)
    return
  }
  // Anything before the first part belongs to the chapter itself.
  yield* readSections(body.slice(0, parts[0].index), chapterId, 2, seen)
  for (const part of parts) {
    const heading = [...elements(part.inner, "div", cls("PartTitle"))][0]?.inner ?? part.inner.slice(0, 600)
    const number = (first(heading, "div", "PartNumber") ?? "").replace(/^PART\s+/i, "").trim()
    const id = `${chapterId}-p${number || seen.size}`
    yield {
      location_id: id,
      doc_type: "PART",
      doc_level_id: number,
      title: titleCase(first(heading, "span", "PartName") ?? "") || null,
      parent_location_id: chapterId,
      depth: 2,
    }
    seen.add(id)
    yield* readSections(part.inner, id, 3, seen)
  }
}

/** Every `<div class="Section">` in a fragment, as a leaf of `parent`. */
function* readSections(html, parent, depth, seen) {
  for (const section of elements(html, "div", cls("Section"))) {
    // "SectionNumber" also names the entries of the chapter's index; a real
    // section carries a body.
    const number = (first(section.inner, "span", "SectionNumber") ?? "").replace(/\s+$/, "").trim()
    if (!number) continue
    const catchline = first(section.inner, "span", "CatchlineText")
    const bodies = [...elements(section.inner, "span", cls("SectionBody"))]
    if (!bodies.length) continue
    const words = bodies.map((b) => text(b.inner)).join("\n\n")
    // The Legislature sets the history block as a div in some chapters and a
    // span in others; it is the law's own provenance either way.
    const history = ["div", "span"]
      .flatMap((tag) => [...elements(section.inner, tag, cls("History"))])
      .map((h) => line(h.inner))
      .filter(Boolean)
      .join("\n")
    if (seen.has(number)) continue
    seen.add(number)
    yield {
      location_id: number,
      doc_type: "SECTION",
      doc_level_id: number,
      title: catchline ? catchline.replace(/[.—-]\s*$/, "") : null,
      parent_location_id: parent,
      depth,
      repealed: /\brepealed\b/i.test(catchline ?? ""),
      text: [`${number} ${catchline ?? ""}`.trim(), words, history].filter(Boolean).join("\n\n") || null,
    }
  }
}
