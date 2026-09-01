import { notFound } from "next/navigation"

import { readFilters } from "@/lib/filters"
import { billSystemPrompt, changelogHtml, summaryHtml } from "@/lib/policy/bill-html"
import { getBill, getBills, getBillText, resolve } from "@/lib/policy/queries"
import { BillText } from "@/components/bill-text"
import { AssistChat } from "@/components/policy/assist-chat"
import { BillNotes } from "@/components/policy/bill-notes"
import { AVAILABLE_CONTENT_OPTIONS } from "@/app/(typeset)/lib/fixtures"

// The five pages of the bill workspace: Docs = the summary, Chat = the
// assistant on this bill, Article = the official text, Changelog = every
// action, Notes = yours. The rail's filters arrive as search params; the
// content is rendered on request from the policy database.
export function generateStaticParams() {
  return AVAILABLE_CONTENT_OPTIONS.map((option) => ({ name: option.value }))
}

export default async function TypesetFixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { name } = await params

  if (!AVAILABLE_CONTENT_OPTIONS.some((option) => option.value === name)) {
    notFound()
  }

  const sp = await searchParams
  const flat = Object.fromEntries(
    Object.entries(sp).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  ) as Record<string, string | undefined>
  const filters = readFilters(flat)
  const resolved = await resolve(filters)

  let billId = Number(filters.bill ?? 0)
  if (!billId) {
    const { rows } = await getBills(resolved, 1)
    billId = rows[0]?.bill_id ?? 0
  }
  const bill = billId ? await getBill(billId) : null

  if (!bill) {
    return (
      <div className="typeset w-full">
        <h1>No bill</h1>
        <p>Nothing matches the rail. Loosen a filter, or pick a bill.</p>
      </div>
    )
  }

  if (name === "docs") {
    return (
      <div
        className="typeset w-full"
        dangerouslySetInnerHTML={{ __html: summaryHtml(bill) }}
      />
    )
  }

  if (name === "changelog") {
    return (
      <div
        className="typeset w-full"
        dangerouslySetInnerHTML={{ __html: changelogHtml(bill) }}
      />
    )
  }

  if (name === "article") {
    const version = Number(flat.version ?? 0) || undefined
    const text = await getBillText(bill.bill_id, version)
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="typeset w-full">
          <h1>{bill.bill_number}</h1>
          <p>
            <em>
              {text
                ? `${text.document_desc ?? text.version ?? "Text"} · ${text.chars.toLocaleString()} characters`
                : "The text of this bill has not been fetched yet."}
            </em>
          </p>
        </div>
        {text && <BillText text={text.text} className="my-2" />}
      </div>
    )
  }

  if (name === "notes") {
    return <BillNotes billId={bill.bill_id} billNumber={bill.bill_number} title={bill.title} />
  }

  // chat
  const chatId = flat.chat || `bill-${bill.bill_id}`
  return (
    <div className="flex min-h-[70vh] w-full flex-col gap-6">
      <div className="typeset w-full">
        <h1>{bill.bill_number}</h1>
        <p>
          <em>{bill.title}</em>
        </p>
      </div>
      <AssistChat
        chatId={chatId}
        system={billSystemPrompt(bill, resolved.state)}
        placeholder={`Ask about ${bill.bill_number}…`}
        starters={[
          `What does ${bill.bill_number} do?`,
          "Who supports it and who might object?",
          "What happens next in the process?",
        ]}
      />
    </div>
  )
}
