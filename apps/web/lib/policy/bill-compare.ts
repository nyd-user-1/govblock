import { billCitation } from "@/lib/policy/congress"
import "server-only"

import { withScope } from "@/lib/config"
import { layoutBillText } from "@/lib/policy/bill-text-layout"
import { lineDiff } from "@/lib/policy/line-diff"
import { getBill, getBillText } from "@/lib/policy/queries"

// Every printing of a bill against the one before it, as rows a redline draws
// (2026-09-11). Read by /bills/[id]/compare and, through the policy API's
// `bill-compare`, by Typeset's Diff page. Not to be confused with
// bill-diff.ts, which summarises one pair of versions for the assistant.
//
// Sponsor memos ride in the same texts table and are left out.

export type { CompareRow, ComparePass, BillComparison } from "@/lib/policy/bill-compare-types"
import type { CompareRow, ComparePass, BillComparison } from "@/lib/policy/bill-compare-types"

type Printing = { document_id: number; version: string | null }

/**
 * Printing order. New York's are named Original, Amendment A, B…; anything
 * else falls back to document id by magnitude, oldest first — New York's
 * synthesised ids are negative, and the order a guess not yet checked against
 * other jurisdictions.
 */
function order(p: Printing) {
  const version = p.version ?? ""
  if (/^original$/i.test(version)) return -1
  const amendment = /^amendment ([a-z])$/i.exec(version)
  if (amendment) return amendment[1].toUpperCase().charCodeAt(0)
  return 1000 + Math.abs(p.document_id) / 1e12
}

/**
 * One printing against the next as rows in reading order: unchanged lines
 * once (as the later printing sets them), each change's removed lines before
 * its added ones. Reflow mode, so re-wrapped lines are not changes.
 */
function redline(before: string, after: string): CompareRow[] {
  const d = lineDiff(before, after, { reflow: true })
  // lineDiff's tokenizer reads the layout line for line against the raw text;
  // the same alignment tells which lines are page furniture.
  const furniture = (text: string) => layoutBillText(text).lines.map((l) => l.kind === "furniture")
  const aFurniture = furniture(before)
  const bFurniture = furniture(after)
  const rows: CompareRow[] = []
  d.blocks.forEach((block, k) => {
    if (block.kind === "equal") {
      const count = block.bCount ?? block.count
      for (let i = 0; i < count; i++) rows.push({ change: "same", text: d.bLines[block.b + i], furniture: bFurniture[block.b + i] })
    } else {
      block.del.forEach((text, i) => rows.push({ change: "del", text, marks: block.delMarks[i], furniture: aFurniture[block.a + i], block: k, order: i }))
      block.add.forEach((text, i) => rows.push({ change: "add", text, marks: block.addMarks[i], furniture: bFurniture[block.b + i], block: k, order: i }))
    }
  })
  return rows
}

export async function getBillComparison(billId: number): Promise<BillComparison | null> {
  const bill = await getBill(billId)
  if (!bill) return null
  const printings = ((bill.texts ?? []) as Printing[])
    .filter((t) => !/memo/i.test(t.version ?? ""))
    .sort((a, b) => order(a) - order(b))
  const texts = await Promise.all(printings.map((p) => getBillText(billId, p.document_id)))
  const named = printings
    .map((p, i) => ({ name: p.version ?? `Printing ${i + 1}`, text: texts[i]?.text ?? null }))
    .filter((p): p is { name: string; text: string } => !!p.text)
  return {
    href: withScope(`/bills/${billId}`, bill.state),
    number: billCitation(bill.bill_number, bill.state),
    title: bill.title,
    printings: named.map((p) => p.name),
    passes: named.slice(1).map((after, i) => ({ from: named[i].name, to: after.name, rows: redline(named[i].text, after.text) })),
  }
}
