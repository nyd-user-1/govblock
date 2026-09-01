import * as React from "react"
import Link from "next/link"
import { IconRss } from "@tabler/icons-react"

import { stateName } from "@/lib/filters"
import { fmtDate, truncate } from "@/lib/format"
import * as F from "@/lib/fixtures"
import { getStream, scopeStates, type StreamBill } from "@/lib/policy/stream"
import { getBillTexts } from "@/lib/policy/texts"
import { CodeFigure, printedWithChanges } from "@/components/code-block"
import { OpenInV0Cta } from "@/components/open-in-v0-cta"
import { FlagChip } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"

// Ported from livingston-v3 app/(app)/docs/changelog-v2/page.tsx: the bill
// stream as the docs' installation steps — one step per bill as it moves, the
// action as the step, the text as the titled code block beneath with the
// amended lines highlighted.
export const metadata = { title: "Changelog", description: "Latest updates and announcements." }
// Congress and the jurisdiction in scope, from mv_stream_latest, rebuilt hourly.
export const revalidate = 3600

// Congress and the jurisdiction in scope, twelve bills each, full text behind
// Expand. MAX_LINES is a safety for a runaway text, not a design.
const PER_STREAM = 12
const LONG = 14
const MAX_LINES = 400

type Entry = StreamBill & { state: string; session: number }

export default async function ChangelogV2Page() {
  const { groups, source } = await getStream({ states: scopeStates(F.STATE), limit: PER_STREAM })
  const entries: Entry[] = groups
    .flatMap((group) => group.bills.map((bill) => ({ ...bill, state: group.state, session: group.session })))
    .sort((a, b) => ((a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1))
  const texts = await getBillTexts(entries.map((bill) => Number(bill.bill_id)))
  return (
    <div data-slot="docs" data-source={source} className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h1 className="scroll-m-24 text-4xl font-semibold tracking-tight sm:text-3xl">Changelog</h1>
              <Button variant="secondary" size="sm" render={<a href="/rss.xml" target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                <IconRss />
                RSS
              </Button>
            </div>
            <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">Latest updates and announcements.</p>
          </div>
          <div className="typeset w-full flex-1 pb-16 sm:pb-0">
            <div className="steps mb-12 md:ml-4 md:border-l md:pl-8">
              {entries.map((bill) => {
                const text = texts.get(Number(bill.bill_id))
                const block = text ? printedWithChanges(text) : null
                const lines = block ? block.code.split("\n") : []
                const code = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES).join("\n") + `\n… ${lines.length - MAX_LINES} more lines` : block?.code
                return (
                  <React.Fragment key={`${bill.state}-${bill.bill_id}`}>
                    <h3 id={`${bill.state}-${bill.bill_number}`} className="scroll-mt-24 md:relative">
                      <FlagChip state={bill.state} width={36} className="mr-2 inline-block align-middle md:absolute md:mt-[2px] md:ml-[-56px]" />
                      <Link href={`/typeset?state=${bill.state}&session=${bill.session}&bill=${bill.bill_id}`} className="no-underline hover:underline">
                        {stateName(bill.state)} {bill.bill_number}
                      </Link>
                      {bill.last_action ? ` — ${truncate(bill.last_action, 90)}` : ""}
                    </h3>
                    <p>
                      {fmtDate(bill.last_action_date)}
                      {bill.status_desc ? ` · ${bill.status_desc}` : ""}
                      {bill.committee ? ` · ${bill.committee} Committee` : ""}
                      {bill.sponsor ? ` · ${bill.sponsor}` : ""}
                    </p>
                    <p>{truncate(bill.title, 240)}</p>
                    {block && (
                      <CodeFigure
                        title={`${bill.state.toLowerCase()}/${bill.session}/${bill.bill_number}.txt`}
                        code={code!}
                        highlighted={block.changed}
                        collapsible={lines.length > LONG}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 lg:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="no-scrollbar flex flex-col gap-8 overflow-y-auto px-8">
          <div className="flex flex-col gap-2 p-4 pt-0 text-sm">
            <p className="sticky top-0 h-6 bg-background text-xs font-medium text-muted-foreground">On This Page</p>
            {entries.map((bill) => (
              <a key={`${bill.state}-${bill.bill_id}`} href={`#${bill.state}-${bill.bill_number}`} className="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground">
                {stateName(bill.state)} {bill.bill_number}
              </a>
            ))}
          </div>
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <OpenInV0Cta />
        </div>
      </div>
    </div>
  )
}
