import { notFound } from "next/navigation"

import { BillCompare } from "@/components/bill-compare"
import { getBill } from "@/lib/policy/queries"
import { getBillComparison } from "@/lib/policy/bill-compare"

// /bills/[id]/compare — every printing of a bill against the one before it
// (2026-09-11), first built for the RAISE Act, S6953: Original → Amendment A
// → Amendment B. The same comparison opens in Typeset as its Diff page.

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bill = await getBill(Number(id))
  return { title: bill ? `${bill.bill_number} printings compared` : "Compare printings" }
}

export default async function CompareBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comparison = await getBillComparison(Number(id))
  if (!comparison) notFound()
  return <BillCompare {...comparison} />
}
