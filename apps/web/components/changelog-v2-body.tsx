"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import Link from "next/link"
import { IconRss } from "@tabler/icons-react"

import { CONGRESS, STATE_CODES, stateName } from "@/lib/filters"
import { fmtBill, fmtDate, truncate } from "@/lib/format"
import type { StreamBill, StreamGroup } from "@/lib/policy/stream"
import { policyUrl } from "@/lib/policy/use-policy"
import { CodeFrame, CodeLines, printedWithChanges } from "@/components/code-block"
import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper"
import { PublicRail } from "@/components/block-card"
import { FlagChip } from "@/components/policy/imagery"
import { useReached } from "@/components/rail-toggle"
import { Button } from "@govblock/ui/components/nova/button"

// The body of changelog-v2, and the root's changelog sheet: every state with
// Congress (Brendan, 2026-09-15), the two most recently acted-on bills of
// each, newest first, whatever jurisdiction the header is on. The page's
// prerendered Congress stands until the states land.

const LONG = 14
const MAX_LINES = 400

export type Entry = StreamBill & { state: string; session: number }

const newestFirst = (groups: StreamGroup[]): Entry[] =>
  groups
    .flatMap((group) => group.bills.map((bill) => ({ ...bill, state: group.state, session: group.session })))
    .sort((a, b) => ((a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1))

// The stream route reads six jurisdictions a request and bill-texts forty
// ids, so both go out in batches, in parallel; the bills land first and their
// texts fill in beneath them.
const EVERY = [CONGRESS, ...STATE_CODES]
const PER_STATE = 2
const STATE_BATCH = 6
const TEXT_BATCH = 40

const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))

/** One policy read; Aurora takes about twenty seconds to resume from a pause, so three more tries spaced for it, as useSnapshot does. */
async function read<T>(url: string): Promise<T | null> {
  for (const wait of [0, 3000, 8000, 15000]) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    try {
      const response = await fetch(url)
      if (response.ok) return (await response.json()) as T
      if (response.status === 403) return null
    } catch {
      // The next try.
    }
  }
  return null
}

/** Every state's stream and its texts, read once `active` is true; `entries` is null until the bills land. */
function useEveryState(active: boolean) {
  const [entries, setEntries] = React.useState<Entry[] | null>(null)
  const [texts, setTexts] = React.useState<Map<number, string>>(() => new Map())

  React.useEffect(() => {
    if (!active) return
    let alive = true
    void (async () => {
      const batches = await Promise.all(chunk(EVERY, STATE_BATCH).map((states) => read<StreamGroup[]>(policyUrl("stream", {}, { states: states.join(","), limit: PER_STATE }))))
      if (!alive) return
      const next = newestFirst(batches.flatMap((groups) => (Array.isArray(groups) ? groups : [])))
      setEntries(next)
      await Promise.all(
        chunk(next.map((bill) => Number(bill.bill_id)), TEXT_BATCH).map(async (ids) => {
          const got = await read<Record<string, string>>(policyUrl("bill-texts", {}, { ids: ids.join(",") }))
          if (!alive || !got) return
          setTexts((current) => {
            const merged = new Map(current)
            for (const [id, text] of Object.entries(got)) merged.set(Number(id), text)
            return merged
          })
        })
      )
    })()
    return () => {
      alive = false
    }
  }, [active])

  return { entries, texts }
}

export function ChangelogV2Body({ initial, initialTexts }: { initial: Entry[]; initialTexts: Record<string, string> }) {
  const every = useEveryState(true)
  const entries = every.entries ?? initial
  const texts = React.useMemo(() => {
    const merged = new Map(Object.entries(initialTexts).map(([id, text]) => [Number(id), text]))
    for (const [id, text] of every.texts) merged.set(id, text)
    return merged
  }, [initialTexts, every.texts])

  return (
    <div data-slot="docs" data-source={every.entries ? "database" : "server"} className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <ChangelogMain entries={entries} texts={texts} empty="Nothing on file." />
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 lg:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="no-scrollbar flex flex-col gap-8 overflow-y-auto px-8">
          <div className="flex flex-col gap-2 p-4 pt-0 text-sm">
            <p className="sticky top-0 h-6 bg-background text-xs font-medium text-muted-foreground">On This Page</p>
            {entries.map((bill) => (
              <a key={`${bill.state}-${bill.bill_id}`} href={`#${bill.state}-${bill.bill_number}`} className="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground">
                {stateName(bill.state)} {fmtBill(bill.bill_number, bill.state)}
              </a>
            ))}
          </div>
        </div>
        <div className="hidden flex-1 flex-col gap-6 overflow-y-auto px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}

/** The center container: the heading, then a step per bill with its text beneath. */
function ChangelogMain({ entries, texts, empty }: { entries: Entry[]; texts: Map<number, string>; empty: React.ReactNode }) {
  return (
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
        {!entries.length && <p className="py-10 text-sm text-muted-foreground">{empty}</p>}
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
                    {stateName(bill.state)} {fmtBill(bill.bill_number, bill.state)}
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
                  // Bill text has no tokens to colour, and this is a client component, so the plain frame.
                  lines.length > LONG ? (
                    <CodeCollapsibleWrapper title={`${bill.state.toLowerCase()}/${bill.session}/${bill.bill_number}.txt`} code={code!}>
                      <CodeLines code={code!} highlighted={block.changed} />
                    </CodeCollapsibleWrapper>
                  ) : (
                    <CodeFrame title={`${bill.state.toLowerCase()}/${bill.session}/${bill.bill_number}.txt`} code={code!}>
                      <CodeLines code={code!} highlighted={block.changed} />
                    </CodeFrame>
                  )
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** The root's changelog sheet: the center container alone, read once a reader has opened every sheet on the way to it. */
export function ChangelogSheet() {
  const reached = useReached(["right", "right-2", "right-3"])
  const { entries, texts } = useEveryState(reached)
  if (!reached) return null
  return <ChangelogMain entries={entries ?? []} texts={texts} empty={entries ? "Nothing on file." : <LoadingFlag />} />
}
