// New Jersey — the Statutes (Unannotated), from the Office of Legislative
// Services.
//
// `lis.njleg.state.nj.us` runs Folio's NXT viewer, which navigates by ASP.NET
// postbacks: nothing in the frame addresses a title, and the document node ids
// are opaque, so this state sat blocked. Watching the viewer draw itself
// showed it asking its own server for the tree in XML:
//
//   gateway.dll?f=xmlcontents&command=getchildren&basepathid=<id>&depth=1
//
// which answers with `<n id="statutes/1/2" t="TITLE 1  ACTS, LAWS AND
// STATUTES"/>` — the same children the reader would be shown after a click.
// The tree is two deep and flat under that: one node per title, and under each
// title one node per section, 56,295 of them. Each section's own document is
// addressable by its node id:
//
//   gateway.dll/statutes/1/2/3?f=templates$fn=document-frame.htm$3.0
//
// The edition here is the Office's own and is unannotated, so there is no
// vendor layer to leave behind.
//
// A law here is a title, which is what New Jersey cites: "N.J.S.A. 2C:1-1" is
// title 2C, chapter 1, section 1.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const GATEWAY = "https://lis.njleg.state.nj.us/nxt/gateway.dll"

const CONTENTS = (id) =>
  `${GATEWAY}?f=xmlcontents&command=getchildren&basepathid=${encodeURIComponent("/" + id)}` +
  `&maxnodes=5000&minnodesleft=10&maxgrandchildren=0&depth=1&siteshowhits=true&hidezerohits=true`

const DOCUMENT = (id) => `${GATEWAY}/${id}?f=templates$fn=document-frame.htm$3.0`

export default {
  id: "nj-ols",
  name: "New Jersey Office of Legislative Services — the Statutes (Unannotated)",
  states: ["NJ"],
  source: "https://lis.njleg.state.nj.us/nxt/gateway.dll/statutes",

  async *laws({ state, only, have, log }) {
    // The root holds one edition, and the edition holds the titles.
    const edition = (await children(state, "statutes"))[0]
    if (!edition) throw new Error("New Jersey named no edition")
    const titles = await children(state, edition.id)
    log(`${titles.length} titles`)

    for (const title of titles) {
      // "TITLE 2C      THE NEW JERSEY CODE OF CRIMINAL JUSTICE"
      const m = /^TITLE\s+([0-9A-Za-z:.-]+)\s+(.*)$/i.exec(title.name.replace(/\s+/g, " ").trim())
      const number = m ? m[1] : title.name.split(/\s+/)[1]
      const law_id = `T${number}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue
      const law_name = titleCase(m ? m[2] : title.name)

      const sections = await children(state, title.id)
      if (!sections.length) {
        log(`· title ${number} — no section`)
        continue
      }

      let at = 0
      const documents = await map(sections, 8, async (s) => {
        const html = await fetchDoc(state, DOCUMENT(s.id), { notFound: null })
        at += 1
        if (at % 2000 === 0) log(`T${number} · ${at}/${sections.length} fetched`)
        return html
      })

      const nodes = [
        { location_id: "TITLE", doc_type: "TITLE", doc_level_id: number, title: law_name, parent_location_id: null, depth: 0 },
      ]
      const seen = new Set(["TITLE"])
      for (let i = 0; i < sections.length; i++) {
        // The node's own label carries the citation and the catchline, and is
        // the heading the document repeats.
        const label = sections[i].name.replace(/\s+/g, " ").trim()
        const cited = /^([0-9A-Za-z]+:[0-9A-Za-z.:-]+?)\.?\s+(.*)$/.exec(label)
        const cite = cited ? cited[1] : label.slice(0, 60)
        const catchline = cited ? cited[2] : ""
        const location_id = unique(cite, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: cite,
          title: titleCase(catchline.replace(/\.$/, "")) || null,
          parent_location_id: "TITLE",
          depth: 1,
          repealed: /\brepealed\b/i.test(catchline),
          text: read(documents[i], label),
        })
      }

      log(`${law_id} · ${nodes.length - 1} sections · ${law_name}`)
      yield { law_id, law_name, law_type: "CONSOLIDATED", chapter: number, nodes: inOrder(nodes) }
    }
  },
}

/** The children of one node, in the order the viewer would show them. */
async function children(state, id) {
  const xml = await fetchDoc(state, CONTENTS(id), { notFound: null })
  if (!xml) return []
  const out = []
  for (const m of String(xml).matchAll(/<n\b([^>]*)\/>/g)) {
    const head = m[1]
    const id = /\bid="([^"]*)"/.exec(head)?.[1]
    const name = /\bt="([^"]*)"/.exec(head)?.[1]
    if (!id || !name) continue
    out.push({ id, name: unescapeXml(name), folder: /application\/folder/.test(head) })
  }
  return out
}

/** One document: the heading Folio prints, then the words of the section. */
function read(html, label) {
  if (!html) return null
  // Folio's head script writes a whole document into a string — `<html><head>`
  // … `</body></html>` — so the first `<body>` in the file is the one in that
  // string and the document's own is the last.
  const whole = String(html)
  const opens = [...whole.matchAll(/<body\b[^>]*>/gi)]
  const from = opens.length ? opens[opens.length - 1].index + opens[opens.length - 1][0].length : 0
  const to = whole.lastIndexOf("</body>")
  const words = text(whole.slice(from, to > from ? to : undefined)).replace(/\n{3,}/g, "\n\n").trim()
  if (!words) return null
  // The document opens with the same heading the node carried; keep one copy.
  return words.startsWith(label.slice(0, 20)) ? words : [label, words].join("\n\n")
}

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
