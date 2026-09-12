// Connecticut — the General Statutes, from the General Assembly.
//
// `cga.ct.gov/current/pub` publishes one page per chapter, with the whole of
// the chapter on it: a `<span class="catchln">` opens each section, carrying
// its number and catchline, and the paragraphs that follow are the law until
// the next one. The chapter page also prints its own table of contents first,
// in `toc_catchln` spans, which is skipped.
//
// The case annotations Connecticut prints under a section are the Commission's
// editorial layer and are left where they are; the source note and the history
// are the law's own provenance and are taken, on the same terms as
// California's enacting line.
//
// A law here is a title, which is how Connecticut arranges the Statutes, and
// the citation a reader knows — "Conn. Gen. Stat. § 1-1" — is the section's
// own number and is its location.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.cga.ct.gov/current/pub"

const cls = (name) => new RegExp(`class="[^"]*\\b${name}\\b[^"]*"`)

export default {
  id: "ct-cga",
  name: "Connecticut General Assembly — the General Statutes",
  states: ["CT"],
  source: "https://www.cga.ct.gov/current/pub/titles.htm",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/titles.htm`)
    const titles = []
    for (const row of elements(index, "tr")) {
      const m = /href="(title_([0-9a-z]+)\.htm)"/.exec(row.inner)
      if (!m || titles.some((t) => t.slug === m[2])) continue
      const designation = firstOf(row.inner, "span", "toc_ttl_desig")
      const name = firstOf(row.inner, "span", "toc_ttl_name")
      titles.push({
        slug: m[2],
        number: (designation ?? m[2]).replace(/^Title\s*/i, ""),
        name: titleCase(name ?? ""),
      })
    }
    log(`${titles.length} titles`)

    for (const title of titles) {
      const law_id = `T${title.number.toUpperCase()}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const contents = await fetchDoc(state, `${BASE}/title_${title.slug}.htm`, { notFound: null })
      if (!contents) {
        log(`✗ ${law_id} — no contents page`)
        continue
      }
      const chapters = []
      for (const row of elements(contents, "tr")) {
        const m = /href="(chap_([0-9a-z]+)\.htm)"/.exec(row.inner)
        if (!m || chapters.some((c) => c.slug === m[2])) continue
        const labels = [...elements(row.inner, "a")].map((a) => line(a.inner)).filter(Boolean)
        const designation = labels.find((l) => /^Chapter\b/i.test(l)) ?? `Chapter ${m[2]}`
        chapters.push({
          slug: m[2],
          number: designation.replace(/^Chapter\s*/i, ""),
          name: titleCase(labels.find((l) => !/^Chapter\b/i.test(l)) ?? ""),
        })
      }
      // A title that names no chapter is a title Connecticut has reserved; it
      // has a number and a heading and nothing under it yet.
      if (!chapters.length) {
        log(`· ${law_id} — the contents list no chapters (reserved)`)
        continue
      }

      const documents = await map(chapters, 10, (chapter) =>
        fetchDoc(state, `${BASE}/chap_${chapter.slug}.htm`, { notFound: null })
      )

      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: title.number, title: title.name || `Title ${title.number}`, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      let sections = 0

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const chapterId = unique(`ch${chapter.number}`, seen)
        seen.add(chapterId)
        nodes.push({
          location_id: chapterId,
          doc_type: "CHAPTER",
          doc_level_id: chapter.number,
          title: chapter.name || null,
          parent_location_id: "TITLE",
          depth: 1,
        })
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
        law_name: title.name || `Title ${title.number}`,
        law_type: "CONSOLIDATED",
        chapter: title.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

/**
 * One chapter page. The sections run from the first `catchln` to the end; the
 * `toc_catchln` links above it are the chapter's own contents and are not it.
 */
function* readChapter(html, chapterId, seen) {
  const heads = [...elements(html, "span", cls("catchln"))].filter((h) => !cls("toc_catchln").test(h.head))
  for (let i = 0; i < heads.length; i++) {
    const head = heads[i]
    const label = line(head.inner)
    // "Sec. 1-1. Words and phrases." — and, where the General Assembly has
    // reserved or repealed a run of numbers, "Secs. 1-101cc to 1-101ll." or
    // "Secs. 1-19 and 1-19a.", which the chapter prints as one entry and which
    // is kept as one.
    const m = /^Secs?\.\s*([0-9][0-9A-Za-z.-]*?)\.?(?:\s+(to|and)\s+([0-9][0-9A-Za-z.-]*?)\.?)?\s*\.\s*(.*)$/s.exec(label)
    if (!m) continue
    const number = m[3] ? `${m[1]} ${m[2]} ${m[3]}` : m[1]
    const location_id = unique(number, seen)
    seen.add(location_id)
    // A section runs to the next catchline, or to the end of the chapter.
    const until = heads[i + 1] ? heads[i + 1].index : html.length
    const fragment = html.slice(head.end, until)
    // The annotations the Commission prints under a section are its layer,
    // not the General Assembly's, and stop the section where they begin.
    const annotation = fragment.search(cls("annotation"))
    const words = text(annotation > 0 ? fragment.slice(0, lastTagBefore(fragment, annotation)) : fragment)
    yield {
      location_id,
      doc_type: "SECTION",
      doc_level_id: number,
      title: titleCase(m[4].replace(/\.$/, "")) || null,
      parent_location_id: chapterId,
      depth: 2,
      repealed: /\brepealed\b/i.test(label),
      text: [label, words].filter(Boolean).join("\n\n") || null,
    }
  }
}

/** The start of the tag whose attributes matched, so a fragment cuts cleanly. */
function lastTagBefore(html, at) {
  const open = html.lastIndexOf("<", at)
  return open < 0 ? at : open
}

function firstOf(html, tag, name) {
  for (const e of elements(html, tag, cls(name))) return line(e.inner)
  return null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
