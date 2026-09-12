// A PDF as prose, for the states that publish their law that way.
//
// Kentucky serves one PDF per section, North Dakota and Wyoming one per
// chapter or title, Colorado one per title. None of them is scanned — the text
// is in the file — so nothing here needs OCR; it needs a reader that runs
// without a system package, because the box the loads run on cannot reach a
// package mirror. `unpdf` is already in the app's tree and wraps pdf.js, which
// is that reader.
//
// A page's lines come back in the order the file lays them out, and the
// wrapping is the printer's rather than the law's, so paragraphs are rejoined
// the same way every other jurisdiction's are: a line that starts indented, or
// with a subsection marker, begins a paragraph, and the rest continues one.
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { UA } from "./fetch.mjs"
import { originalPath } from "./pool.mjs"

const require = createRequire(import.meta.url)

let unpdf = null
const load = async () => (unpdf ??= await import(require.resolve("unpdf")))

/**
 * One PDF, fetched, kept as the original it is, and read as text.
 *
 * The bytes go to disk under the same tree as every other original, so the
 * archive that reaches S3 holds the PDF the state published rather than only
 * what was made of it.
 */
export async function fetchPdf(state, url, { notFound = "throw" } = {}) {
  const file = originalPath(state, url).replace(/\.body$/, ".pdf")
  const isPdf = (b) => b.length > 4 && String.fromCharCode(b[0], b[1], b[2], b[3]) === "%PDF"
  let bytes
  if (existsSync(file) && isPdf(new Uint8Array(readFileSync(file)))) {
    bytes = new Uint8Array(readFileSync(file))
  } else {
    const response = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" })
    if (response.status === 404 || response.status === 410) {
      if (notFound === "throw") throw new Error(`404 ${url}`)
      return null
    }
    if (!response.ok) throw new Error(`${response.status} for ${url}`)
    bytes = new Uint8Array(await response.arrayBuffer())
    // A page served as HTML where a PDF was expected is not a PDF.
    if (!isPdf(bytes)) {
      if (notFound === "throw") throw new Error(`not a PDF: ${url}`)
      return null
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, bytes)
  }
  const { extractText, getDocumentProxy } = await load()
  const document = await getDocumentProxy(bytes)
  const { text } = await extractText(document, { mergePages: true })
  return typeof text === "string" ? text : text.join("\n")
}

/**
 * A printed column as paragraphs: the printer's line breaks are dropped and a
 * paragraph runs until the next one begins.
 *
 * What begins one is deliberately narrow — a subsection marker, a section
 * mark, one of the labels a state prints under the law — because a number and
 * a full stop at the head of a line is more often a citation the printer
 * happened to wrap onto ("…that KRS \n 1.020 shall not…") than a new
 * paragraph.
 */
export function prose(raw, { opens = /^\s*(\(\w+\)|§|Effective:|History:|NOTE:|[A-Z][A-Z ]{8,}$)/ } = {}) {
  const out = []
  for (const raw_line of String(raw).split("\n")) {
    const flat = raw_line.replace(/\s+/g, " ").trim()
    if (!flat) {
      if (out.length && out[out.length - 1] !== "") out.push("")
      continue
    }
    const starts = opens.test(raw_line) || !out.length || out[out.length - 1] === ""
    if (starts) out.push(flat)
    else out[out.length - 1] += " " + flat
  }
  return out.filter(Boolean).join("\n\n").trim()
}
