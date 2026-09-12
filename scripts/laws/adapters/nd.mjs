// North Dakota — the Century Code, from the Legislative Council.
//
// `ndlegis.gov/cencode/t01c01.pdf` is a whole chapter, typeset by the Council
// and carrying its text rather than a scan. The Council's own index page is a
// site menu rather than a list of chapters, so the chapters are enumerated:
// every title from 1 to 65 and every chapter under it, with the numbers North
// Dakota does not use answering 404 and remembered as gaps.
//
// A chapter's PDF runs the sections together — "1-01-01. This act - How
// referred to. This revision…" — so a section is cut where its own number
// begins, which is the only mark the print gives.
//
// A law here is a chapter, which is what North Dakota cites: "N.D.C.C.
// § 1-01-01" is title 1, chapter 01, section 01.
import { fetchPdf, prose } from "../lib/pdf.mjs"
import { map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { titleCase } from "../lib/text.mjs"

const FILE = (t, c) => `https://ndlegis.gov/cencode/t${t}c${c}.pdf`

const CHAPTERS = []
for (let t = 1; t <= 65; t++)
  for (let c = 1; c <= 60; c++) CHAPTERS.push({ t: String(t).padStart(2, "0"), c: String(c).padStart(2, "0") })

// "1-01-01." and "1-01-01.1." both open a section; the number is the whole run
// of digits and dashes before the full stop that is followed by a space.
const OPENS = /(?=\b\d{1,2}-\d{2}-\d{2}(?:\.\d+)?\.\s)/g

export default {
  id: "nd-council",
  name: "North Dakota Legislative Council — the North Dakota Century Code",
  states: ["ND"],
  source: "https://ndlegis.gov/cencode/cencode.html",

  async *laws({ state, only, have, log }) {
    const wanted = CHAPTERS.filter(
      ({ t, c }) => (!only || `T${Number(t)}C${c}` === only.toUpperCase()) && !have?.has(`T${Number(t)}C${c}`)
    )
    let at = 0
    const documents = await map(wanted, 10, async ({ t, c }) => {
      const pdf = await fetchPdf(state, FILE(t, c), { notFound: null }).catch(() => null)
      at += 1
      if (at % 250 === 0) log(`${at}/${wanted.length} chapter numbers tried`)
      return pdf
    })

    for (let i = 0; i < wanted.length; i++) {
      const raw = documents[i]
      if (!raw) continue
      const { t, c } = wanted[i]
      const law = read(raw, t, c)
      if (!law) continue
      log(`T${Number(t)}C${c} · ${law.nodes.length - 1} sections · ${law.law_name}`)
      yield law
    }
  },
}

function read(raw, t, c) {
  const words = prose(raw).replace(/\s+/g, " ").trim()
  const parts = words.split(OPENS).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  // The head of the file is the title and chapter the Council prints above the
  // first section.
  const head = parts[0]
  const titleName = titleCase((/TITLE\s+\d+\s+([A-Z][A-Z ,'&-]*?)\s+CHAPTER/.exec(head)?.[1] ?? "").trim())
  const chapterName = titleCase((/CHAPTER\s+[\d-]+\s+([A-Z][A-Z ,'&-]*)$/.exec(head)?.[1] ?? "").trim())

  const nodes = [
    {
      location_id: "CHAPTER",
      doc_type: "CHAPTER",
      doc_level_id: `${Number(t)}-${c}`,
      title: [chapterName, titleName].filter(Boolean).join(" — ") || null,
      parent_location_id: null,
      depth: 0,
    },
  ]
  const seen = new Set(["CHAPTER"])
  for (const part of parts.slice(1)) {
    const m = /^(\d{1,2}-\d{2}-\d{2}(?:\.\d+)?)\.\s+(.*)$/s.exec(part)
    if (!m) continue
    const location_id = unique(m[1], seen)
    seen.add(location_id)
    const rest = m[2].trim()
    const cut = /^(.{2,160}?\.)\s+(?=\S)/.exec(rest)
    nodes.push({
      location_id,
      doc_type: "SECTION",
      doc_level_id: m[1],
      title: titleCase((cut ? cut[1] : rest).replace(/\.$/, "")) || null,
      parent_location_id: "CHAPTER",
      depth: 1,
      repealed: /\brepealed\b/i.test(rest.slice(0, 120)),
      text: part,
    })
  }
  if (nodes.length < 2) return null
  return {
    law_id: `T${Number(t)}C${c}`,
    law_name: chapterName || `Chapter ${Number(t)}-${c}`,
    law_type: "CONSOLIDATED",
    chapter: `${Number(t)}-${c}`,
    nodes: inOrder(nodes),
  }
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
