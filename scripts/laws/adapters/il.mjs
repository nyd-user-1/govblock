// Illinois — the Compiled Statutes, from the General Assembly.
//
// `ilga.gov` was rebuilt and the old `ilcs3.asp` paths are gone, which is why
// this state sat open. The new site is better: a chapter lists its acts, and
// an act has a full-text view that hands back every section of it in one
// request — the Illinois Vehicle Code is 8.5 MB and 1,888 sections in a single
// GET. So Illinois is about two thousand requests for the whole state.
//
// A law here is an act, which is the unit Illinois cites: "625 ILCS 5/1-100"
// is chapter 625, act 5, section 1-100. The chapter above it is named on the
// act, because the table holds one tree per law.
//
// Each section is printed as its own table: the ILCS citation, the older
// "from Ch. 1, par. 300" citation beside it, "Sec. N." and the catchline, the
// words of the law, and the public act that last touched it in a Source line.
// All of it is the General Assembly's own; no vendor sits in front.
import { fetchDoc, map } from "../lib/pool.mjs"
import { inOrder } from "../lib/tree.mjs"
import { attrs, elements, line, text } from "../lib/html.mjs"
import { titleCase } from "../lib/text.mjs"

const BASE = "https://www.ilga.gov"

export default {
  id: "il-ilga",
  name: "Illinois General Assembly — the Compiled Statutes",
  states: ["IL"],
  source: "https://www.ilga.gov/Legislation/ILCS/Chapters",

  async *laws({ state, only, have, log }) {
    const index = await fetchDoc(state, `${BASE}/Legislation/ILCS/Chapters`)
    const chapters = []
    for (const a of elements(index, "a")) {
      const href = attrs(a.head).href ?? ""
      if (!/\/Legislation\/ILCS\/Acts\?/i.test(href)) continue
      const number = /ChapterNumber=([0-9A-Za-z.]+)/.exec(href)?.[1]
      if (!number || chapters.some((c) => c.number === number)) continue
      chapters.push({ number, href, name: titleCase(/Chapter=([^&]*)/.exec(href)?.[1]?.replace(/\+|%20/g, " ") ?? "") })
    }
    log(`${chapters.length} chapters`)

    // Every act of every chapter, in the order the chapters list them.
    const acts = []
    await map(chapters, 8, async (chapter) => {
      const page = await fetchDoc(state, new URL(chapter.href, BASE).toString(), { notFound: null })
      for (const a of elements(page ?? "", "a")) {
        const href = attrs(a.head).href ?? ""
        if (!/\/Legislation\/ILCS\/Articles\?/i.test(href)) continue
        const id = /ActID=(\d+)/.exec(href)?.[1]
        if (!id || acts.some((x) => x.id === id)) continue
        acts.push({ id, href, chapter, name: titleCase(line(a.inner)) })
      }
    })
    log(`${acts.length} acts`)

    const wanted = acts.filter((a) => (!only || `A${a.id}` === only.toUpperCase()) && !have?.has(`A${a.id}`))
    let at = 0

    for (const act of wanted) {
      const page = await fetchDoc(state, new URL(act.href, BASE).toString(), { notFound: null })
      at += 1
      if (at % 100 === 0) log(`${at}/${wanted.length} acts`)
      if (!page) {
        log(`✗ act ${act.id} — no page`)
        continue
      }
      // A long act is paged into ranges on its own listing, and carries a
      // full-text link that is the whole of it in one request.
      const full = [...elements(page, "a")]
        .map((a) => attrs(a.head).href ?? "")
        .find((h) => /ChapAct=FullText/i.test(h))
      const body = full ? await fetchDoc(state, new URL(full, BASE).toString(), { notFound: null }) : page
      if (!body) {
        log(`✗ act ${act.id} — no text`)
        continue
      }

      const name = act.name || titleCase(line([...elements(body, "h2")][0]?.inner ?? "")) || `Act ${act.id}`
      const nodes = [
        {
          location_id: "ACT",
          doc_type: "PART",
          doc_level_id: "",
          title: [name, act.chapter.name].filter(Boolean).join(" — "),
          parent_location_id: null,
          depth: 0,
        },
      ]
      const seen = new Set(["ACT"])
      for (const node of readAct(body, seen)) nodes.push(node)
      if (nodes.length < 2) {
        log(`· act ${act.id} — no section on the page`)
        continue
      }
      log(`A${act.id} · ${nodes.length - 1} sections · ${name}`)
      yield {
        law_id: `A${act.id}`,
        law_name: name,
        law_type: "CONSOLIDATED",
        chapter: act.chapter.number,
        nodes: inOrder(nodes),
      }
    }
  },
}

/** Every section of an act, each in its own table, in printed order. */
function* readAct(html, seen) {
  for (const table of elements(html, "table")) {
    const flat = prose(table.inner)
    if (!flat) continue
    // "(5 ILCS 5/0.01) (from Ch. 1, par. 300) Sec. 0.01. Short title. …"
    const cite = /\((\d+[A-Za-z]?\s+ILCS\s+[^)]+)\)/.exec(flat)?.[1]
    const opening = /(?:^|\n|\s)Sec\.?\s+([0-9A-Za-z][0-9A-Za-z.-]*)\.\s*(.*)$/s.exec(flat)
    if (!opening) continue
    const number = cite ? cite.replace(/\s+/g, " ").trim() : `Sec. ${opening[1]}`
    const location_id = unique(number, seen)
    seen.add(location_id)
    const rest = opening[2].replace(/[ \t]+/g, " ").trim()
    // Many of the older sections have no catchline at all — "Sec. 1. Whenever
    // the Congress of the United States…" is the law itself — so a catchline
    // is only taken when it reads like one: short, and with the law behind it.
    const cut = /^(.{2,110}?\.)\s+(?=\S)/.exec(rest)
    yield {
      location_id,
      doc_type: "SECTION",
      doc_level_id: opening[1],
      title: cut ? titleCase(cut[1].replace(/\.$/, "")) || null : null,
      parent_location_id: "ACT",
      depth: 1,
      repealed: /\brepealed\b/i.test(rest.slice(0, 200)),
      text: flat,
    }
  }
}

/**
 * A section's table as prose.
 *
 * The General Assembly prints the Compiled Statutes as a Courier column with a
 * `<br>` at the end of every printed line, so the line breaks are wrapping
 * rather than paragraphs. A paragraph begins where the print indents — four
 * non-breaking spaces — and the rest is rejoined, which is the same bargain
 * every other jurisdiction here is held to.
 */
function prose(inner) {
  // The only break the print means is `<br>`; the stray empty `<p></p>` pairs
  // between the Courier spans are the page's own scaffolding.
  const source = inner.replace(/<\/?p\b[^>]*>/gi, " ").replace(/<br\s*\/?>/gi, "\n")
  const lines = text(source, { keepIndent: true }).split("\n")
  const out = []
  for (const raw of lines) {
    const flat = raw.replace(/\s+/g, " ").trim()
    if (!flat) continue
    // The print indents where a paragraph begins, and starts a citation or a
    // source line at the margin; everything else is a wrapped continuation.
    const starts = /^\s{3,}/.test(raw) || /^\((?:\d|from|Source)/i.test(flat)
    if (starts || !out.length) out.push(flat)
    else out[out.length - 1] += " " + flat
  }
  return out.join("\n\n").trim()
}

function unique(id, seen) {
  if (!seen.has(id)) return id
  let n = 2
  while (seen.has(`${id}~${n}`)) n += 1
  return `${id}~${n}`
}
