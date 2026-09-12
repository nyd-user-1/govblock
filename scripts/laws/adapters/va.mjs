// Virginia — the Code of Virginia, from the Division of Legislative Automated
// Systems.
//
// `law.lis.virginia.gov/vacode/` is a table of contents of titles, each title
// a list of chapters, each chapter a list of sections, and each section its
// own page carrying the law and the acts of assembly that made it. The
// `vacodefull` view that would give a whole chapter at once renders its text
// on the client, so the per-section pages are the honest route and the pool
// reads them at the site's pace.
//
// Virginia's API registration was applied for and has not come back. Nothing
// here waits on it: if the key arrives the adapter changes and the rows are
// refreshed, and until then the open web has the same Code.
//
// A law here is a title, which is how Virginia arranges and cites: "Va. Code
// § 1-1" is section 1-1 of title 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://law.lis.virginia.gov"

export default {
  id: "va-lis",
  name: "Virginia Division of Legislative Automated Systems — the Code of Virginia",
  states: ["VA"],
  source: "https://law.lis.virginia.gov/vacode/",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/vacode/`)
    // The contents are a definition list: the link is the designation and the
    // name is the description beside it, so a title's name is the `<dd>`
    // rather than anything inside the `<a>`.
    const titles = named(index, /^\/vacode\/(title([0-9A-Za-z.]+))\/$/)
    log(`${titles.length} titles`)

    for (const title of titles) {
      const law_id = `T${title.number.toUpperCase()}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const contents = await fetchDoc(state, `${BASE}/vacode/${title.slug}/`, { notFound: null })
      if (!contents) {
        log(`✗ ${law_id} — no contents page`)
        continue
      }
      const chapters = named(contents, new RegExp(`^/vacode/${title.slug}/(chapter([0-9A-Za-z.]+))/$`))
      if (!chapters.length) {
        log(`✗ ${law_id} — the title lists no chapter`)
        continue
      }

      // A chapter's own page lists its sections; the sections themselves are
      // read after, so the whole title's pages move at the pool's width rather
      // than one chapter at a time.
      const lists = await map(chapters, 10, (chapter) =>
        fetchDoc(state, `${BASE}/vacode/${title.slug}/${chapter.slug}/`, { notFound: null })
      )
      const plan = []
      for (let i = 0; i < chapters.length; i++) {
        plan.push({ kind: "CHAPTER", ...chapters[i] })
        for (const section of sectionsOf(lists[i] ?? "", title.slug, chapters[i].slug)) plan.push({ kind: "SECTION", ...section })
      }
      const sections = plan.filter((p) => p.kind === "SECTION")
      if (!sections.length) {
        log(`✗ ${law_id} — the chapters list no section`)
        continue
      }

      let at = 0
      const bodies = await map(sections, 12, async (section) => {
        const html = await fetchDoc(state, `${BASE}${section.href}`, { notFound: null })
        at += 1
        if (at % 1000 === 0) log(`  ${law_id} ${at}/${sections.length} sections`)
        return html
      })

      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: title.number, title: title.name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      let parent = "TITLE"
      let read = 0

      for (const item of plan) {
        if (item.kind === "CHAPTER") {
          const location_id = unique(item.slug, seen)
          seen.add(location_id)
          nodes.push({ location_id, doc_type: "CHAPTER", doc_level_id: item.number, title: item.name, parent_location_id: "TITLE", depth: 1 })
          parent = location_id
          continue
        }
        const html = bodies[read++]
        const location_id = unique(item.number, seen)
        seen.add(location_id)
        const body = html ? readSection(html) : null
        // The contents list a section by number alone; its catchline is the
        // heading the section page prints over the law.
        const heading = body ? /^§+\s*[0-9A-Za-z.:-]+\.\s*(.*)$/.exec(body.split("\n")[0] ?? "")?.[1] : null
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: item.number,
          title: item.name ?? (heading ? titleCase(heading.replace(/\.$/, "")) : null),
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(item.name ?? heading ?? ""),
          text: body ?? `§ ${item.number}. ${item.name ?? ""}`.trim(),
        })
      }

      log(`${law_id} · ${chapters.length} chapters · ${sections.length.toLocaleString("en-US")} sections · ${title.name}`)
      yield { law_id, law_name: title.name || `Title ${title.number}`, law_type: "CONSOLIDATED", chapter: title.number, nodes: inOrder(nodes) }
    }
  },
}

/**
 * The entries of one of Virginia's definition lists — "Title 1" in the term
 * and "General Provisions" in the description under it — for every link whose
 * address matches, in the order they are printed.
 */
function named(html, match) {
  const out = []
  const terms = [...elements(html, "dt")]
  const descriptions = [...elements(html, "dd")]
  for (let i = 0; i < terms.length; i++) {
    for (const a of elements(terms[i].inner, "a")) {
      const m = match.exec(attrs(a.head).href ?? "")
      if (!m || out.some((x) => x.slug === m[1])) continue
      out.push({
        slug: m[1],
        number: m[2],
        // The description ends with the span of sections the level covers —
        // "[§§ 1-1 through 1-9]" — which the tree itself already says.
        name:
          titleCase(
            line(descriptions[i]?.inner ?? "")
              .replace(/\s+/g, " ")
              .replace(/\s*\[\s*§[^\]]*\]\s*$/, "")
              .trim()
          ) || null,
      })
      break
    }
  }
  return out
}

/** The sections a chapter page links to, in the order it lists them. */
function* sectionsOf(html, titleSlug, chapterSlug) {
  const seen = new Set()
  for (const a of elements(html, "a")) {
    const href = attrs(a.head).href ?? ""
    const m = new RegExp(`^/vacode/${titleSlug}/${chapterSlug}/section([0-9A-Za-z.:-]+)/$`).exec(href)
    if (!m || seen.has(m[1])) continue
    seen.add(m[1])
    const label = line(a.inner).replace(/\s+/g, " ").trim()
    const named = /^§+\s*[0-9A-Za-z.:-]+\.?\s*(.*)$/.exec(label)
    yield { href, number: m[1], name: (titleCase(named ? named[1] : label) ?? "").replace(/\.$/, "") || null }
  }
}

/** A section page: the heading Virginia prints and the law under it. */
function readSection(html) {
  for (const span of elements(html, "span", /id=["']va_code["']/)) {
    const words = text(span.inner)
    if (words) return words
  }
  return null
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
