// The United States Code, a title at a time, as the Office of the Law Revision
// Counsel publishes it: USLM, one file per title at a release point. "Laws"
// holds the same release point as text with its USLM thrown away
// (scripts/laws/adapters/us.mjs), so the Code's sections are read from the
// release point itself, each one its own Expression, native.
import { createRequire } from "node:module"

import { endOf } from "../../laws/lib/xml.mjs"

const require = createRequire(import.meta.url)
const { unzipSync } = require("fflate")

export const RELEASE = process.env.USC_RELEASE || "119/103"
const BASE = `https://uscode.house.gov/download/releasepoints/us/pl/${RELEASE}`
const UA = "govblock-xml/1.0 (+https://gov.nysgpt.com; brendan@nysgpt.com)"

/** "USC10" → "10", "USC05A" → "05a": the OLRC's file name for the title. */
const fileTitle = (unit) => {
  const m = /^USC(\d+)([A-Z]?)$/i.exec(unit)
  if (!m) return null
  return `${m[1].padStart(2, "0")}${m[2].toLowerCase()}`
}

export async function* uscTitle({ unit, log }) {
  const t = fileTitle(unit)
  if (!t) throw Object.assign(new Error(`${unit} is not a title of the Code`), { blocked: true })
  const url = `${BASE}/xml_usc${t}@${RELEASE.replace("/", "-")}.zip`
  const t0 = Date.now()
  const response = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(600_000) })
  const bytes = new Uint8Array(await response.arrayBuffer())
  // A title that is not published (53 is reserved) is answered with a page and a 200.
  if (!response.ok || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw Object.assign(new Error(`title ${t} is not published at release point ${RELEASE}`), { blocked: true })
  const files = unzipSync(bytes)
  const name = Object.keys(files).find((n) => /usc\w+\.xml$/i.test(n))
  if (!name) throw new Error(`the archive for title ${t} held no XML`)
  const xml = Buffer.from(files[name]).toString("utf8")
  log(`title ${t}: ${(xml.length / 1e6).toFixed(1)} MB of USLM in ${((Date.now() - t0) / 1000).toFixed(1)} s`)

  // The title's own <meta> goes on every section, so each stored document
  // still says which release point it came from.
  const metaAt = xml.indexOf("<meta")
  const meta = metaAt >= 0 ? xml.slice(metaAt, xml.indexOf("</meta>", metaAt) + 7) : ""
  const root = /<uscDoc\b[^>]*>/.exec(xml)?.[0] ?? `<uscDoc xmlns="http://xml.house.gov/schemas/uslm/1.0">`

  // A section of the Code is a <section> whose identifier is the section's
  // own path. Sections quoted inside notes carry none, or repeat one already
  // taken, and are skipped with the section that holds them.
  const open = /<section\b[^>]*\bidentifier="(\/us\/usc\/t[0-9A-Za-z]+\/s[^"/]+)"[^>]*>/g
  const seen = new Set()
  let m
  let count = 0
  while ((m = open.exec(xml))) {
    const identifier = m[1]
    const end = endOf(xml, "section", m.index)
    open.lastIndex = end
    if (seen.has(identifier)) continue
    seen.add(identifier)
    count++
    const section = xml.slice(m.index, end)
    const num = /<num\b[^>]*>([\s\S]*?)<\/num>/.exec(section)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? ""
    const status = /\bstatus="([^"]+)"/.exec(m[0])?.[1]
    yield {
      work: identifier,
      unit: "",
      session: null,
      label: `${Number(t.replace(/\D/g, ""))}${t.replace(/\d/g, "").toUpperCase()} U.S.C. ${identifier.replace(/^.*\/s/, "")}`,
      sourceUrl: `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${t.replace(/^0/, "")}-section${identifier.replace(/^.*\/s/, "")}`,
      sourceRef: `olrc:${RELEASE}:${identifier}`,
      frontEnd: "US",
      source: { kind: "xml", body: `${root}${meta}<main>${section}</main></uscDoc>`, url },
      info: { kind: "statute", root: "uscDoc", number: num, publisher: "Office of the Law Revision Counsel", fidelity: "native-xml", preferDocDate: true, docDateBasis: "release", path: status ? `status: ${status}` : null },
    }
  }
  yield { count }
  log(`title ${t}: ${count.toLocaleString()} sections`)
}
