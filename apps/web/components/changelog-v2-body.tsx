"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import Link from "next/link"
import { IconRss } from "@tabler/icons-react"
import { CircleCheck, CircleX, Info, Loader2 } from "lucide-react"

import { CONGRESS, memberHref, STATE_CODES, stateName } from "@/lib/filters"
import { fmtBill, fmtDate, honorific, truncate } from "@/lib/format"
import { chamberFromNumber, chamberImage } from "@/lib/imagery"
import type { StreamBill, StreamGroup } from "@/lib/policy/stream"
import { BILL_PATH, billPath } from "@/lib/policy/bill-path"
import { policyUrl } from "@/lib/policy/use-policy"
import { matchesQuery } from "@/lib/search-match"
import { CodeFrame, CodeLines, printedWithChanges } from "@/components/code-block"
import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper"
import { SearchDirectory } from "@/components/directory-search"
import { DownloadButton } from "@/components/download-button"
import { FavoriteToggle } from "@/components/favorite-star"
import { HeadingAnchor } from "@/components/heading-anchor"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"
import { useReached } from "@/components/rail-toggle"
import { useRootSheets } from "@/lib/root-sheets"
import { Button } from "@govblock/ui/components/nova/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// The body of changelog-v2, and the root's changelog sheet: every state with
// Congress (Brendan, 2026-09-15), the two most recently acted-on bills of
// each, newest first, whatever jurisdiction the header is on. The page's
// prerendered Congress stands until the states land.

const LONG = 14
// A block that prints few lines but long ones (Massachusetts runs its whole docket header together) collapses too.
const LONG_CHARS = 900
const MAX_LINES = 400

export type Entry = StreamBill & { state: string; session: number }

// Newest last action first, whoever's it is (Brendan, 2026-09-20): a changelog reads in the order things happened.
// On a day two jurisdictions share, Congress leads and the states follow by name, so the order does not shuffle
// between reads. Until then the bills were dealt a round at a time with Congress first in each (2026-09-15), which
// put a Congress bill of August 27 over a Pennsylvania bill of September 18.
export const byLastAction = (a: Entry, b: Entry) =>
  (b.last_action_date ?? "").localeCompare(a.last_action_date ?? "") ||
  Number(b.state === CONGRESS) - Number(a.state === CONGRESS) ||
  stateName(a.state).localeCompare(stateName(b.state)) ||
  Number(b.bill_id) - Number(a.bill_id)

const newestFirst = (groups: StreamGroup[]): Entry[] => groups.flatMap((group) => group.bills.map((bill) => ({ ...bill, state: group.state, session: group.session }))).sort(byLastAction)

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

/**
 * Every state's stream and its texts, read once `active` is true; `entries` is null until the bills land.
 * `more` asks for each jurisdiction's next bills (Brendan, 2026-09-20): the stream read has a limit and no
 * offset, so a deeper limit is asked for and the rounds it adds land after the ones already shown; only the
 * new bills' texts are read. When a deeper read brings nothing new, the stream is `exhausted`.
 */
function useEveryState(active: boolean) {
  const [entries, setEntries] = React.useState<Entry[] | null>(null)
  const [texts, setTexts] = React.useState<Map<number, string>>(() => new Map())
  const [depth, setDepth] = React.useState(PER_STATE)
  const [loading, setLoading] = React.useState(false)
  const [exhausted, setExhausted] = React.useState(false)
  const have = React.useRef(new Set<number>())
  const shown = React.useRef(0)

  React.useEffect(() => {
    if (!active) return
    let alive = true
    setLoading(true)
    void (async () => {
      const batches = await Promise.all(chunk(EVERY, STATE_BATCH).map((states) => read<StreamGroup[]>(policyUrl("stream", {}, { states: states.join(","), limit: depth }))))
      if (!alive) return
      const next = newestFirst(batches.flatMap((groups) => (Array.isArray(groups) ? groups : [])))
      if (depth > PER_STATE && next.length <= shown.current) setExhausted(true)
      shown.current = next.length
      setEntries(next)
      setLoading(false)
      const fresh = next.map((bill) => Number(bill.bill_id)).filter((id) => !have.current.has(id))
      for (const id of fresh) have.current.add(id)
      await Promise.all(
        chunk(fresh, TEXT_BATCH).map(async (ids) => {
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
  }, [active, depth])

  const more = React.useCallback(() => setDepth((d) => d + PER_STATE), [])
  return { entries, texts, more, loading, exhausted }
}

// /changelog on the docs shell (Brendan, 2026-09-20): the page draws DocsPage,
// and these three are what it puts in it. The provider reads every state once
// and hands the same bills to the steps in the center container and to the
// index in the right rail; until the states land, the page's prerendered
// Congress stands. Until then the body carried a hand-built shell of its own.
const ChangelogContext = React.createContext<{ entries: Entry[]; texts: Map<number, string>; source: "database" | "server"; query: string; setQuery: (value: string) => void; more: () => void; loading: boolean; canLoad: boolean } | null>(null)

export function ChangelogProvider({ initial, initialTexts, children }: { initial: Entry[]; initialTexts: Record<string, string>; children: React.ReactNode }) {
  const every = useEveryState(true)
  const entries = every.entries ?? initial
  const texts = React.useMemo(() => {
    const merged = new Map(Object.entries(initialTexts).map(([id, text]) => [Number(id), text]))
    for (const [id, text] of every.texts) merged.set(id, text)
    return merged
  }, [initialTexts, every.texts])
  // The search bar under the rule (Brendan, 2026-09-20) filters the steps, and the rail's index with them.
  const [query, setQuery] = React.useState("")
  const shown = React.useMemo(() => {
    const q = query.trim()
    return q ? entries.filter((bill) => matchesQuery(q, stateName(bill.state), bill.state, fmtBill(bill.bill_number, bill.state), bill.bill_number, bill.title, bill.last_action, bill.status_desc, bill.committee, bill.sponsor)) : entries
  }, [entries, query])
  // More is asked for only once the first read has landed, while there is more, and not over a search's results.
  const canLoad = !!every.entries && !every.exhausted && !query.trim()
  const value = React.useMemo(() => ({ entries: shown, texts, source: every.entries ? ("database" as const) : ("server" as const), query, setQuery, more: every.more, loading: every.loading, canLoad }), [shown, texts, every.entries, every.more, every.loading, canLoad, query])
  return <ChangelogContext.Provider value={value}>{children}</ChangelogContext.Provider>
}

/** The center container's content: a step per bill. */
export function ChangelogSteps() {
  const stream = React.useContext(ChangelogContext)
  if (!stream) return null
  return (
    <div data-source={stream.source}>
      <SearchDirectory query={stream.query} setQuery={(value) => stream.setQuery(value ?? "")} placeholder="Search the changelog by state, bill, title, action or sponsor…" />
      <div className="mt-8" />
      <Steps entries={stream.entries} texts={stream.texts} empty={stream.query.trim() ? `Nothing matching “${stream.query.trim()}”.` : "Nothing on file."} />
      <ChangelogMore />
    </div>
  )
}

/** The right rail's index of the bills on the page. */
export function ChangelogIndex() {
  const stream = React.useContext(ChangelogContext)
  if (!stream?.entries.length) return null
  return (
    <div className="flex flex-col gap-2 p-4 pt-0 text-sm">
      <p className="h-6 text-xs font-medium text-muted-foreground">On This Page</p>
      {stream.entries.map((bill) => (
        <a key={`${bill.state}-${bill.bill_id}`} href={`#${bill.state}-${bill.bill_number}`} className="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground">
          {stateName(bill.state)} {fmtBill(bill.bill_number, bill.state)}
        </a>
      ))}
      <ChangelogMore />
    </div>
  )
}

/** The end of the steps and of the rail's index: reaching either asks for each jurisdiction's next bills, a spinner turning while they come. */
function ChangelogMore() {
  const stream = React.useContext(ChangelogContext)
  const mark = React.useRef<HTMLDivElement>(null)
  const canLoad = !!stream?.canLoad && !stream.loading
  const more = stream?.more
  React.useEffect(() => {
    const el = mark.current
    if (!el || !canLoad || !more) return
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more())
    observer.observe(el)
    return () => observer.disconnect()
  }, [canLoad, more])
  if (!stream?.canLoad) return null
  return (
    <div ref={mark} className="flex h-8 items-center justify-center text-muted-foreground">
      {stream.loading && <Loader2 aria-label="Loading more" className="size-4 animate-spin" />}
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
        <Steps entries={entries} texts={texts} empty={empty} />
      </div>
    </div>
  )
}

// Where the bill stands, as a callout over its text (Brendan, 2026-09-20; after the text until later that day): one line — the status in the one
// vocabulary every jurisdiction shares, the committee, the day — and the colour says the outcome before a word
// is read. The icon explains its colour on hover: the check and the cross for the two endings, the info circle
// for the two that are still open.
const TONES = {
  done: { icon: CircleCheck, means: "Became law, or was adopted", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  ended: { icon: CircleX, means: "Stopped: vetoed, failed or withdrawn", className: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300" },
  waiting: { icon: Info, means: "Passed the legislature, waiting on the governor", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  moving: { icon: Info, means: "Moving through the legislature", className: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
} as const

function StatusCallout({ bill, origin }: { bill: Entry; origin: string | null }) {
  const path = billPath(bill.status_desc, origin)
  const tone = TONES[path.done ? "done" : path.ended ? "ended" : path.reached === BILL_PATH.length ? "waiting" : "moving"]
  const Icon = tone.icon
  return (
    <div role="status" className={cn("not-typeset mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm", tone.className)}>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
          <Icon aria-label={tone.means} className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {tone.means}
        </TooltipContent>
      </Tooltip>
      <p className="m-0 min-w-0 font-medium">
        {bill.status_desc || "Introduced"}
        {bill.committee ? ` · ${bill.committee} Committee` : ""}
        {bill.last_action_date ? ` · ${fmtDate(bill.last_action_date)}` : ""}
      </p>
    </div>
  )
}

/** The sponsor's title, from the chamber the bill started in: a bill's first sponsor sits there. */
const sponsorTitle = (origin: string | null) => honorific(origin === "Senate" ? "Sen" : origin === "House" ? "Rep" : null, origin)

/** The five-step marker: filled to where the bill stands, red where it left the path. */
function PathMarker({ status, origin }: { status: string | null; origin: string | null }) {
  const path = billPath(status, origin)
  const label = path.ended ? `Left the path at ${BILL_PATH[path.reached - 1]}` : `${BILL_PATH[path.reached - 1]}, step ${path.reached} of ${BILL_PATH.length}`
  return (
    <span role="img" aria-label={label} className="inline-flex shrink-0 items-center gap-1">
      {BILL_PATH.map((step, i) => (
        // Each tick names its stage on hover (Brendan, 2026-09-20); the tall hit area keeps a 6px bar easy to reach.
        <Tooltip key={step}>
          <TooltipTrigger render={<span className="flex h-5 items-center" />}>
            <span className={cn("h-1.5 w-5 rounded-full", i < path.reached ? (path.ended ? "bg-destructive" : path.done ? "bg-emerald-500" : "bg-foreground") : "bg-border")} />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {step}
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  )
}

/** A step per bill as it moves: the action as the step, the text as the titled code block beneath. */
function Steps({ entries, texts, empty }: { entries: Entry[]; texts: Map<number, string>; empty: React.ReactNode }) {
  return (
    <>
        {!entries.length && <p className="py-10 text-sm text-muted-foreground">{empty}</p>}
        <div className="steps steps-roomy mb-12 md:ml-4 md:border-l md:pl-8">
          {entries.map((bill) => {
            const text = texts.get(Number(bill.bill_id))
            const block = text ? printedWithChanges(text) : null
            const lines = block ? block.code.split("\n") : []
            // The chamber's seal where the file icon was, as the bill page's text block has it (Brendan, 2026-09-20).
            // The whole text, not the block's first MAX_LINES, under the caption's name (Brendan, 2026-09-20).
            const download = block ? <DownloadButton value={block.code} filename={`${bill.state.toLowerCase()}/${bill.session}/${bill.bill_number}.txt`} /> : null
            // The bill kept as a favorite, from the right of the copy button (Brendan, 2026-09-20).
            const chamber = bill.body ?? chamberFromNumber(bill.bill_number)
            // The chamber it started in, which is its sponsor's: a bill's number names it wherever the bill now sits.
            const origin = chamberFromNumber(bill.bill_number)
            const same = (a: string, b: string) => a.replace(/\W+/g, "").toLowerCase() === b.replace(/\W+/g, "").toLowerCase()
            const description = bill.description && !same(bill.description, bill.title ?? "") ? bill.description : null
            const star = <FavoriteToggle item={{ href: `/bills/${bill.bill_id}`, title: `${stateName(bill.state)} ${fmtBill(bill.bill_number, bill.state)}`, detail: truncate(bill.title, 120) || null, image: chamberImage(bill.state, chamber), external: false }} />
            const seal = <ChamberSeal state={bill.state} chamber={bill.body ?? chamberFromNumber(bill.bill_number)} size={16} />
            const code = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES).join("\n") + `\n… ${lines.length - MAX_LINES} more lines` : block?.code
            return (
              <React.Fragment key={`${bill.state}-${bill.bill_id}`}>
                {/* The item's four slots, the same for every bill of every jurisdiction (Brendan,
                    2026-09-20): who and what, the title, where it stands on the path every bill
                    walks, then the day and the legislature's own words for what happened. Only the
                    last slot's wording is the state's; the rest is one vocabulary. */}
                <h3 id={`${bill.state}-${bill.bill_number}`} className="flex scroll-mt-24 items-center justify-between gap-4 text-2xl md:relative">
                  <span className="min-w-0">
                    <FlagChip state={bill.state} width={36} className="mr-2 inline-block align-middle md:absolute md:mt-[2px] md:ml-[-56px]" />
                    <HeadingAnchor href={`/bills/${bill.bill_id}`}>
                      {stateName(bill.state)} {fmtBill(bill.bill_number, bill.state)}
                    </HeadingAnchor>
                  </span>
                  {/* The path, opposite the bill's number (Brendan, 2026-09-20). */}
                  <PathMarker status={bill.status_desc} origin={origin} />
                </h3>
                {/* The sponsor on a line of its own under the bill (Brendan, 2026-09-20), not run on after its number. */}
                {bill.sponsor && (
                  <h4 className="my-0! text-lg font-semibold tracking-tight">
                    <HeadingAnchor href={bill.sponsor_id ? memberHref(bill.sponsor_id, bill.state) : undefined} id={bill.sponsor_id ? undefined : `${bill.state}-${bill.bill_number}-sponsor`}>
                      {`${sponsorTitle(origin)} ${bill.sponsor}`.trim()}
                    </HeadingAnchor>
                  </h4>
                )}
                {/* A title and a description for every bill (Brendan, 2026-09-20); many records carry the title twice, and it is printed once. */}
                <p className="line-clamp-2 font-medium">{bill.title}</p>
                {description && <p className="mt-1! line-clamp-3 text-muted-foreground">{description}</p>}
                {/* Where it stands comes before the text, not after it (Brendan, 2026-09-20, later): the callout under the
                    description, then the rule, then the text. */}
                <StatusCallout bill={bill} origin={origin} />
                <hr className="mt-4! mb-0! border-0 border-t border-border" />
                {block && (
                  // Bill text has no tokens to colour, and this is a client component, so the plain frame.
                  lines.length > LONG || code!.length > LONG_CHARS ? (
                    <CodeCollapsibleWrapper icon={seal} action={download} after={star} title={`${bill.state.toLowerCase()}/${bill.session}/${bill.bill_number}.txt`} code={code!}>
                      <CodeLines code={code!} highlighted={block.changed} />
                    </CodeCollapsibleWrapper>
                  ) : (
                    <CodeFrame icon={seal} action={download} after={star} title={`${bill.state.toLowerCase()}/${bill.session}/${bill.bill_number}.txt`} code={code!}>
                      <CodeLines code={code!} highlighted={block.changed} />
                    </CodeFrame>
                  )
                )}
              </React.Fragment>
            )
          })}
        </div>
    </>
  )
}

/**
 * The root's changelog sheet: the center container alone, and a demonstration (Brendan, 2026-09-20) — a dozen bills
 * frozen in lib/data/root-sheets.json, not the API, mounted when a reader first opens their way to it. Until then it
 * read every state a second and a half into each load of the root and drew a hundred bills' texts behind a closed
 * sheet, which held the page for some four seconds.
 */
export function ChangelogSheet() {
  const reached = useReached(["right"])
  const file = useRootSheets(reached)
  const texts = React.useMemo(() => new Map(Object.entries(file?.changelog.texts ?? {}).map(([id, text]) => [Number(id), text])), [file])
  const entries = React.useMemo(() => [...(file?.changelog.entries ?? [])].sort(byLastAction), [file])
  if (!reached) return null
  return <ChangelogMain entries={entries} texts={texts} empty={file ? "Nothing on file." : <LoadingFlag />} />
}
