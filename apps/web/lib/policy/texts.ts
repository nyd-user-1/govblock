import { TEXTS } from "@/lib/data"
import { sql } from "@/lib/policy/db"

// Comfortably inside the Data API's 1 MB result cap after JSON framing.
// The ::int cast at the call site matters: the shim binds a JS integer as
// bigint, and left(text, bigint) is not a function Postgres has.
const MAX_TEXT = 800_000

// Bill texts, latest version per bill, in one query — "BillTexts" is indexed
// on bill_id. The committed texts stand in when the database is not reachable.

// v3's cleanBillText: New York Assembly texts arrive as a scrape of the whole
// page ahead of an "<bill> Text:" marker and end with "Go to top" — keep the
// bill only.
//
// California's (source `state_link`, 2026-09-03) are a scrape of the whole
// leginfo page: 150 lines of scripts and navigation, then the bill's heading
// and digest, then the enacted text as a handful of lines a thousand
// characters long. Surveyed that day: the only state whose texts carry page
// junk (40 of the newest 40; every other state read clean). The right fix is
// the Legislative Counsel's pubinfo source; until those land, the page is cut
// to the bill and the giant lines broken at the sections the text itself
// names, so the document reads and diffs line by line.
export function cleanBillText(raw: string) {
  let text = String(raw ?? "").replace(/\r/g, "")
  const marker = text.match(/^\s*[A-Z]\d+[A-Z]? Text:[ \t]*$/m)
  if (marker?.index !== undefined) text = text.slice(marker.index + marker[0].length)
  if (/^Bill Text\s+-\s/.test(text) && /CALIFORNIA LEGISLATURE/.test(text)) text = cleanLeginfo(text)
  return text.replace(/^\s*Go to top\s*$/gm, "").replace(/^\n+/, "").replace(/\s+$/, "")
}

function cleanLeginfo(page: string) {
  const lines = page.split("\n")
  let start = lines.findIndex((l) => /CALIFORNIA LEGISLATURE/.test(l))
  // The chamber and the date sit two lines above the legislature's name.
  for (let i = start - 1; i >= Math.max(0, start - 3); i--) if (/^\s*(Senate|Assembly)\s*$/.test(lines[i])) start = i
  let end = lines.findIndex((l, i) => i > start && /^\s*REVISIONS:\s*$/.test(l))
  if (end < 0) end = lines.length
  const body = lines
    .slice(Math.max(0, start), end)
    .map((l) => l.replace(/\u00a0/g, " ").replace(/^[\t ]+/, (m) => m.replace(/\t/g, "")))
    .join("\n")
  return (
    body
      // The parts of the page the text itself names, each on its own line.
      .replace(/\s*(LEGISLATIVE COUNSEL'S DIGEST)\s*/g, "\n\n$1\n\n")
      .replace(/\s*(Bill Text)\s+(The people of the State of California do enact as follows:)\s*/g, "\n\n$2\n\n")
      .replace(/\s+(SEC(?:TION)?\.\s+\d+\.)\s+/g, "\n\n$1 ")
      // A subdivision, paragraph or digest item after two or more spaces starts a line.
      .replace(/ {2,}(\(\d+\)|\([a-z]\)|\([A-Z]\)|\([ivx]+\))\s*/g, "\n$1 ")
      // Sentences the scrape ran together with two or more spaces.
      .replace(/([.;:])\s{2,}(?=[A-Z(“"])/g, "$1\n")
      .replace(/[ \t]{3,}/g, "  ")
      .replace(/\n{3,}/g, "\n\n")
  )
}

export async function getBillTexts(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (!ids.length) return out
  if (sql) {
    const run = sql
    try {
      // One bill per call, in parallel: the Data API caps a result at 1 MB and a
      // single bill's text can approach that on its own, so batching several into
      // one statement would fail on exactly the long bills people care about.
      // MAX_TEXT keeps one oversized bill from failing the whole page; the full
      // text is in the lake (s3://govblock-lake-.../lake/v1/text/bill_texts).
      const rows = (
        await Promise.all(
          ids.map(
            (id) => run`
        select t.bill_id, left(t.text, ${MAX_TEXT}::int) as text, length(t.text) as full_length
        from "BillTexts" t
        where t.bill_id = ${id} and t.text is not null
        order by t.document_id desc
        limit 1`
          )
        )
      ).flat() as { bill_id: number | string; text: string; full_length: number }[]

      for (const row of rows) {
        if (row.full_length > MAX_TEXT) {
          console.warn(`texts: bill ${row.bill_id} truncated at ${MAX_TEXT} of ${row.full_length} chars`)
        }
        out.set(Number(row.bill_id), cleanBillText(row.text))
      }
      return out
    } catch (error) {
      console.error("texts: database unavailable, serving snapshot", error)
    }
  }
  for (const id of ids) {
    const t = TEXTS[String(id)]?.text
    if (t) out.set(id, cleanBillText(t))
  }
  return out
}
