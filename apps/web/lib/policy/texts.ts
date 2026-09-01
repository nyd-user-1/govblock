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
export function cleanBillText(raw: string) {
  let text = String(raw ?? "").replace(/\r/g, "")
  const marker = text.match(/^\s*[A-Z]\d+[A-Z]? Text:[ \t]*$/m)
  if (marker?.index !== undefined) text = text.slice(marker.index + marker[0].length)
  return text.replace(/^\s*Go to top\s*$/gm, "").replace(/^\n+/, "").replace(/\s+$/, "")
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
