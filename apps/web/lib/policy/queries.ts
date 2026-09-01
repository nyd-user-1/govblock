import { BILLS, TEXTS } from "@/lib/data"
import type { Filters } from "@/lib/filters"
import type { Bill, BillText } from "@/lib/policy/types"

// The server-side reads livingston-v3's preview pages make against Neon
// (lib/policy/queries.ts), answered from the bills on file in lib/data.
export type Resolved = Filters & { state: string; session: number }

export async function resolve(filters: Filters): Promise<Resolved> {
  return { ...filters, state: filters.state || "US", session: Number(filters.session) || 2025 }
}

export function billsOnFile(): Bill[] {
  return (Object.values(BILLS) as unknown as Bill[]).slice().sort((a, b) => String(b.last_action_date ?? "").localeCompare(String(a.last_action_date ?? "")))
}

export async function getBills(_f: Resolved, limit = 40, offset = 0) {
  const rows = billsOnFile()
  return { rows: rows.slice(offset, offset + limit), total: rows.length }
}

export async function getBill(billId: number): Promise<Bill | null> {
  return ((BILLS as Record<string, unknown>)[String(billId)] as Bill | undefined) ?? null
}

export async function getBillText(billId: number, documentId?: number): Promise<BillText | null> {
  const bill = await getBill(billId)
  const meta = bill?.texts.find((t) => !documentId || t.document_id === documentId) ?? bill?.texts[0]
  const key = String(documentId ?? meta?.document_id ?? billId)
  const text = TEXTS[key] ?? TEXTS[String(billId)]
  if (!text) return null
  return { document_id: meta?.document_id ?? billId, version: text.version ?? meta?.version ?? null, chars: text.chars ?? text.text.length, fetched_at: meta?.fetched_at ?? null, text: text.text, document_desc: null }
}
