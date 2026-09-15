import "server-only"

import { unstable_cache } from "next/cache"

import { expressionAt, readUslm, type ExpressionRow } from "@/lib/policy/expressions"
import { q } from "@/lib/policy/db"
import { billWork } from "@/lib/xml/address"
import { docToText } from "@/lib/xml/convert"
import { parseXml } from "@/lib/xml/ir"
import { uslmToDoc, type Fidelity } from "@/lib/xml/uslm-to-doc"
import { printBillText, printedLooksParsed } from "@/lib/policy/printed-bill-text"
import { getBillTexts } from "@/lib/policy/texts"

// A bill's printing as text from its stored XML (Brendan, 2026-09-15): one
// unit a line, each level indented by its rank, inserted and struck words in
// the code block's markers. The legislature's own spacing and hard line breaks
// are gone, so every code block reads the way the Typeset reader lays the
// bill out. A printing's XML never changes, so its text is kept by address.

const textOf = unstable_cache(
  async (address: string, row: ExpressionRow) => {
    const xml = await readUslm(row)
    const { doc } = uslmToDoc(parseXml(xml), { dialect: row.dialect ?? "uslm", identifier: row.work, expression: row.expression, fidelity: row.fidelity as Fidelity, title: row.label })
    return docToText(doc, { marked: true }).replace(/\n{3,}/g, "\n\n")
  },
  ["printed-text-v3"],
  { revalidate: false, tags: ["printed-text"] }
)

/** Each bill's newest stored printing as text, for the ids that have one. */
export async function printedTexts(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (!ids.length) return out
  const bills = await q<{ bill_id: number; state: string; session_id: number; session_title: string | null; bill_number: string }>(
    `select bill_id, state, session_id, session_title, bill_number from "Bills" where bill_id = any($1::bigint[])`,
    [ids]
  ).catch(() => [])
  await Promise.all(
    bills.map(async (b) => {
      try {
        const work = billWork({ ...b, special: /special|extraordinary/i.test(b.session_title ?? "") })
        if (!work) return
        const row = await expressionAt(work, null)
        if (!row) return
        const text = await textOf(`${row.work}@${row.expression}`, row)
        // A state whose grammar misread this printing falls back to its words, printed the same way.
        if (text.trim() && printedLooksParsed(text)) out.set(Number(b.bill_id), text)
      } catch (error) {
        console.error("printed text: kept the plain text for", b.bill_id, error)
      }
    })
  )
  return out
}

/** What a code block prints for each bill: the XML where it read cleanly, the stored text printed the same way otherwise. */
export async function codeBlockTexts(ids: number[]): Promise<Map<number, string>> {
  const [printed, plain] = await Promise.all([printedTexts(ids), getBillTexts(ids)])
  const out = new Map<number, string>()
  for (const [id, text] of plain) out.set(id, printBillText(text))
  for (const [id, text] of printed) out.set(id, text)
  return out
}
