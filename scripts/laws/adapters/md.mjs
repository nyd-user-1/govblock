// Maryland — the Annotated Code, from the General Assembly.
//
// `mgaleg.maryland.gov` renders each section on the server into a
// `div#StatuteText`, and the two dropdowns that drive the page are fed by an
// API of its own: `/mgawebsite/api/Laws/GetSections?articleCode=gcj` hands
// back every section of an article — 1,039 of them for Courts and Judicial
// Proceedings — so the whole state is one call per article and one page per
// section.
//
// The Code is called Annotated because the printed edition carries
// LexisNexis's annotations. What the General Assembly serves here is the
// statute alone, which is what is taken.
//
// A law here is an article, which is how Maryland cites: "Md. Code, Cts. &
// Jud. Proc. § 1-101" is section 1-101 of the Courts and Judicial Proceedings
// article.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://mgaleg.maryland.gov/mgawebsite"

export default {
  id: "md-mgaleg",
  name: "Maryland General Assembly — the Annotated Code of Maryland",
  states: ["MD"],
  source: "https://mgaleg.maryland.gov/mgawebsite/Laws/Statutes",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/Laws/Statutes`)
    const articles = []
    // "Courts and Judicial Proceedings - (gcj)" — the code is the value and
    // the name is the option's own text.
    for (const option of elements(index, "option")) {
      const code = /value="([a-z]{2,6})"/.exec(option.head)?.[1]
      if (!code || articles.some((a) => a.code === code)) continue
      const label = line(option.inner).replace(/\s*-\s*\([a-z]+\)\s*$/i, "").trim()
      if (!label) continue
      articles.push({ code, name: titleCase(label) })
    }
    log(`${articles.length} articles`)

    for (const article of articles) {
      const law_id = article.code.toUpperCase()
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue

      const listed = await fetchDoc(state, `${BASE}/api/Laws/GetSections?articleCode=${article.code}&enactments=true`, {
        json: true,
        notFound: null,
      })
      if (!Array.isArray(listed) || !listed.length) {
        log(`✗ ${law_id} — the article lists no section`)
        continue
      }

      let at = 0
      const bodies = await map(listed, 12, async (section) => {
        const html = await fetchDoc(
          state,
          `${BASE}/Laws/StatuteText?article=${article.code}&section=${encodeURIComponent(section.DisplayText)}&enactments=true`,
          { notFound: null }
        )
        at += 1
        if (at % 500 === 0) log(`  ${law_id} ${at}/${listed.length} sections`)
        return html
      })

      const nodes = [
        { location_id: "ARTICLE", doc_type: "ARTICLE", doc_level_id: article.code, title: article.name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["ARTICLE"])
      // Maryland numbers a section "1-101" for title 1, and the title is the
      // only level the site itself draws, so it is made from the number.
      const titles = new Map()

      for (let i = 0; i < listed.length; i++) {
        const number = String(listed[i].DisplayText)
        const words = bodies[i] ? readSection(bodies[i]) : null
        const part = /^([0-9A-Za-z]+)-/.exec(number)?.[1]
        let parent = "ARTICLE"
        if (part) {
          if (!titles.has(part)) {
            const id = `t${part}`
            titles.set(part, id)
            seen.add(id)
            nodes.push({ location_id: id, doc_type: "TITLE", doc_level_id: part, title: null, parent_location_id: "ARTICLE", depth: 1 })
          }
          parent = titles.get(part)
        }
        const location_id = unique(number, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: number,
          title: null,
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(words ?? ""),
          text: words ?? `§ ${number}.`,
        })
      }

      log(`${law_id} · ${listed.length.toLocaleString("en-US")} sections · ${article.name}`)
      yield { law_id, law_name: article.name, law_type: "CONSOLIDATED", chapter: null, nodes: inOrder(nodes) }
    }
  },
}

/**
 * A section page. The container repeats the article's name and the site's own
 * Next buttons above and below the law; neither is the law.
 */
function readSection(html) {
  for (const block of elements(html, "div", /id=["']StatuteText["']/)) {
    const cleaned = block.inner.replace(/<div class="row">[\s\S]*?<\/div>\s*<\/div>/g, " ")
    // The page centres the article's name over every one of its sections; the
    // law itself starts at the section mark.
    const words = text(cleaned).replace(/^Article\s*[-\u2013\u2014]\s*.*\n+/, "").trim()
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
