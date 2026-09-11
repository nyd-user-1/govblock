// Massachusetts — the General Laws, from the General Court's own API.
//
// malegislature.gov/api is a plain JSON API with no key: /Chapters lists the
// 701 chapters, /Chapters/<c> lists a chapter's sections, and
// /Chapters/<c>/Sections/<s> carries the section's catchline and its text.
// There is no bulk file and no way to get a chapter's text in one call, so a
// full load costs a request per section — which is why it goes one at a time,
// caches, and resumes.
//
// A law here is a chapter, which is the unit Massachusetts cites: "G.L. c. 4,
// § 1". The Part and Title above it are the General Court's own arrangement
// and are named on the chapter rather than made into levels, because the table
// holds one tree per law and the chapter is its root — the same choice New
// York's consolidated laws make, where a law is a chapter of the whole.
import { get } from "../lib/fetch.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://malegislature.gov/api"

export default {
  id: "ma-api",
  name: "Massachusetts General Court — General Laws API",
  states: ["MA"],
  source: "https://malegislature.gov/Laws/GeneralLaws",

  async *laws({ only, have, log }) {
    // Which Part and Title each chapter sits under, for the chapter's own line.
    const where = new Map()
    for (const part of await get(`${BASE}/Parts`, { json: true })) {
      const detail = await get(`${BASE}/Parts/${part.Code}`, { json: true })
      for (const chapter of detail.Chapters ?? []) {
        if (!where.has(chapter.Code)) where.set(chapter.Code, titleCase(detail.Name ?? ""))
      }
    }

    const chapters = await get(`${BASE}/Chapters`, { json: true })
    const wanted = chapters.filter((c) => (!only || `C${c.Code}` === only.toUpperCase()))
    log(`${wanted.length} chapters`)

    let at = 0
    for (const listed of wanted) {
      const law_id = `C${listed.Code}`
      at += 1
      // A chapter already written costs nothing to skip, and skipping it is
      // what keeps a re-run from spending thirty thousand requests again.
      if (have?.has(law_id)) continue

      let chapter
      try {
        chapter = await get(`${BASE}/Chapters/${encodeURIComponent(listed.Code)}`, { json: true })
      } catch (error) {
        log(`✗ chapter ${listed.Code} — ${error.message}`)
        continue
      }
      // A repealed chapter with nothing left in it is the API's own answer, not
      // a failure to read it. Say so and move on rather than handing the runner
      // an empty law to reject.
      if (chapter.IsRepealed && !(chapter.Sections ?? []).length) {
        log(`${at}/${wanted.length} · c.${listed.Code} repealed, no sections remain`)
        continue
      }
      const name = titleCase(chapter.Name ?? "") || `Chapter ${listed.Code}`
      const nodes = [
        {
          location_id: "CHAPTER",
          doc_type: "CHAPTER",
          doc_level_id: listed.Code,
          title: [name, where.get(listed.Code)].filter(Boolean).join(" — "),
          parent_location_id: null,
          depth: 0,
          repealed: !!chapter.IsRepealed,
        },
      ]

      const seen = new Set(["CHAPTER"])
      for (const listedSection of chapter.Sections ?? []) {
        const code = String(listedSection.Code ?? "")
        if (!code || seen.has(code)) continue
        let section
        try {
          section = await get(`${BASE}/Chapters/${encodeURIComponent(listed.Code)}/Sections/${encodeURIComponent(code)}`, { json: true })
        } catch {
          // A section listed on the chapter and not served by the API is left
          // out rather than written empty; the runner's check would catch a
          // chapter where that happened to all of them.
          continue
        }
        seen.add(code)
        const body = String(section.Text ?? "").replace(/\r\n/g, "\n").trim()
        nodes.push({
          location_id: code,
          doc_type: "SECTION",
          doc_level_id: code,
          title: section.Name ?? null,
          parent_location_id: "CHAPTER",
          depth: 1,
          repealed: !!section.IsRepealed,
          text: body || null,
        })
      }

      log(`${at}/${wanted.length} · c.${listed.Code} ${name} — ${nodes.length - 1} sections`)
      yield {
        law_id,
        law_name: name,
        law_type: "CONSOLIDATED",
        chapter: listed.Code,
        nodes,
      }
    }
  },
}
