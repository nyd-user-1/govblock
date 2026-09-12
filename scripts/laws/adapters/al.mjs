// Alabama — the Code of Alabama, from the Legislative Services Agency.
//
// `alison.legislature.state.al.us` is a Next.js application with no statute in
// its HTML, and the ledger had Alabama down as "HTML behind a state-run
// viewer". The viewer is a client for a GraphQL service of the Agency's own,
// `gql.api.alison.legislature.state.al.us/graphql`, and that service answers
// two questions that are the whole state:
//
//   codeOfAlabamaTitles                     every title, chapter and section
//                                           there is, in one delimited string
//   codesOfAlabama(where: {displayId})      one section: its title, its
//                                           content and its history
//
// Introspection is turned off, so the queries are the ones the application
// itself sends, read out of its own bundle.
//
// A law here is a chapter, which is what Alabama cites: "Ala. Code § 1-1-1" is
// title 1, chapter 1, section 1.
import { createRequire } from "node:module"

import { inOrder } from "../lib/tree.mjs"
import { map } from "../lib/pool.mjs"
import { text } from "../lib/html.mjs"
import { UA } from "../lib/fetch.mjs"
import { titleCase } from "../lib/text.mjs"

const require = createRequire(import.meta.url)
const { Agent } = require("undici")

const GQL = "https://gql.api.alison.legislature.state.al.us/graphql"

// The Agency's own delimiters: a record separator and a field separator.
const ROWS = "∫"
const FIELDS = "†"

const SECTION = `query section($displayId: String!) {
  codesOfAlabama(where: { type: { eq: Section }, displayId: { eq: $displayId } }) {
    data { codeId displayId title content history effectiveDate }
  }
}`

let dispatcher = null
const agent = () => (dispatcher ??= new Agent({ connect: { timeout: 30000 } }))

async function ask(query, variables) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(GQL, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": UA },
        body: JSON.stringify({ query, variables }),
        dispatcher: agent(),
        signal: AbortSignal.timeout(60000),
      })
      if (!response.ok) throw new Error(`${response.status} from the Agency's service`)
      const body = await response.json()
      if (body.errors?.length) throw new Error(body.errors[0].message)
      return body.data
    } catch (error) {
      if (attempt >= 5) throw error
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
}

export default {
  id: "al-lsa",
  name: "Alabama Legislative Services Agency — the Code of Alabama",
  states: ["AL"],
  source: "https://alison.legislature.state.al.us/code-of-alabama",

  async *laws({ only, have, log }) {
    const { titles } = await ask("query { titles: codeOfAlabamaTitles }", {})
    // The string is a table: a header row, then one row per title, chapter and
    // section, each naming the level it is by how its title reads.
    const rows = String(titles).split(ROWS).map((r) => r.split(FIELDS))
    // The table opens with a separator of its own before the header row.
    const headerAt = rows.findIndex((r) => r.some((c) => c.trim() === "codeId"))
    const header = rows[headerAt].map((h) => h.trim())
    const at = (name) => header.indexOf(name)
    const items = rows.slice(headerAt + 1).map((r) => ({
      codeId: (r[at("codeId")] ?? "").trim(),
      label: (r[at("title")] ?? "").trim(),
      range: (r[at("sectionRange")] ?? "").trim(),
    }))
    log(`${items.length.toLocaleString("en-US")} entries in the Agency's hierarchy`)

    // The hierarchy is flat and ordered; a title opens a title, a chapter opens
    // a chapter, and the sections between belong to the chapter above them.
    const chapters = []
    let title = null
    let chapter = null
    for (const item of items) {
      const heading = /^(Title|Chapter|Article|Division|Part|Subpart|Subdivision|Section)\s+([0-9A-Za-z.:-]+)\s*(.*)$/.exec(item.label)
      if (!heading) continue
      const kind = heading[1]
      if (kind === "Title") {
        title = { number: heading[2].replace(/\.$/, ""), name: titleCase(heading[3].replace(/\.$/, "")) }
        chapter = null
        continue
      }
      if (kind === "Chapter") {
        chapter = {
          number: heading[2].replace(/\.$/, ""),
          name: titleCase(heading[3].replace(/\.$/, "")),
          title,
          sections: [],
          levels: [],
        }
        chapters.push(chapter)
        continue
      }
      if (!chapter) continue
      if (kind === "Section") {
        chapter.sections.push({ displayId: heading[2].replace(/\.$/, ""), name: titleCase(heading[3].replace(/\.$/, "")) })
        continue
      }
      chapter.levels.push({ kind: kind.toUpperCase(), number: heading[2].replace(/\.$/, ""), name: titleCase(heading[3].replace(/\.$/, "")), after: chapter.sections.length })
    }
    log(`${chapters.length} chapters`)

    for (const c of chapters) {
      const law_id = `T${c.title?.number ?? "0"}C${c.number}`
      if (only && law_id !== only.toUpperCase()) continue
      if (have?.has(law_id)) continue
      if (!c.sections.length) continue

      const bodies = await map(c.sections, 8, async (s) => {
        try {
          const data = await ask(SECTION, { displayId: s.displayId })
          return data?.codesOfAlabama?.data?.[0] ?? null
        } catch {
          return null
        }
      })

      const nodes = [
        {
          location_id: "CHAPTER",
          doc_type: "CHAPTER",
          doc_level_id: c.number,
          title: [c.name, c.title?.name].filter(Boolean).join(" — ") || null,
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["CHAPTER"])
      // The levels between the chapter and its sections, at the point the
      // Agency's own ordering puts them.
      const levelsAt = new Map()
      for (const level of c.levels) {
        if (!levelsAt.has(level.after)) levelsAt.set(level.after, [])
        levelsAt.get(level.after).push(level)
      }
      let parent = "CHAPTER"

      for (let i = 0; i < c.sections.length; i++) {
        for (const level of levelsAt.get(i) ?? []) {
          const id = unique(`${level.kind.toLowerCase()}-${level.number}`, seen)
          seen.add(id)
          nodes.push({ location_id: id, doc_type: level.kind, doc_level_id: level.number, title: level.name, parent_location_id: "CHAPTER", depth: 1 })
          parent = id
        }
        const section = c.sections[i]
        const found = bodies[i]
        const location_id = unique(section.displayId, seen)
        seen.add(location_id)
        nodes.push({
          location_id,
          doc_type: "SECTION",
          doc_level_id: section.displayId,
          title: section.name,
          parent_location_id: parent,
          depth: 2,
          repealed: /\brepealed\b/i.test(section.name ?? ""),
          text: [
            `§ ${section.displayId}. ${section.name ?? ""}`.trim(),
            found?.content ? text(found.content) : null,
            found?.history ? text(found.history) : null,
          ]
            .filter(Boolean)
            .join("\n\n"),
        })
      }

      log(`${law_id} · ${c.sections.length} sections · ${c.name}`)
      yield {
        law_id,
        law_name: c.name || `Chapter ${c.number}`,
        law_type: "CONSOLIDATED",
        chapter: c.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
