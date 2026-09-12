import { fmtBill } from "@/lib/format"
import { notFound } from "next/navigation"

import { BillCompare } from "@/components/bill-compare"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { getBill } from "@/lib/policy/queries"
import { getBillComparison } from "@/lib/policy/bill-compare"

// /bills/[id]/compare — every printing of a bill against the one before it
// (2026-09-11), first built for the RAISE Act, S6953: Original → Amendment A
// → Amendment B. The same comparison opens in Typeset as its Diff page. On
// the site's layout like every other record page (Brendan, 2026-09-11): the
// site rail, the redline in the centre column, the passes as a table of
// contents in the right rail. (The printings were tried as morphing tabs the
// same day and undone: the tabs live on in the UI package for another page.)

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bill = await getBill(Number(id))
  return { title: bill ? `${fmtBill(bill.bill_number, bill.state)} printings compared` : "Compare printings" }
}

export default async function CompareBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comparison = await getBillComparison(Number(id))
  if (!comparison) notFound()
  return (
    <DocsPage
      title={`${comparison.number} printings compared`}
      description={`${comparison.title} — ${comparison.printings.join(" → ")}.`}
      lead={<></>}
      slug={`/bills/${id}/compare`}
      previous={{ name: comparison.number, url: comparison.href }}
      next={{ name: "Amendments", url: "/amendments" }}
      rail={<DocsTableOfContents toc={comparison.passes.map((pass, p) => ({ title: `${pass.from} → ${pass.to}`, url: `#pass-${p}`, depth: 2 }))} />}
    >
      <BillCompare {...comparison} width="full" headless />
    </DocsPage>
  )
}
