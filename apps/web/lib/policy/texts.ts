import { TEXTS } from "@/lib/data"
import { sql } from "@/lib/policy/db"

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
    try {
      const rows = (await sql`
        select distinct on (t.bill_id) t.bill_id, t.text
        from "BillTexts" t
        where t.bill_id = any(${ids}::bigint[]) and t.text is not null
        order by t.bill_id, t.document_id desc`) as { bill_id: number | string; text: string }[]
      for (const row of rows) out.set(Number(row.bill_id), cleanBillText(row.text))
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
