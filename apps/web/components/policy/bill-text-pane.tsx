"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, SearchIcon, XIcon } from "lucide-react"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { layoutBillText, printChangeMarks, type BillLayout } from "@/lib/policy/bill-text-layout"
import { useLocal } from "@/lib/policy/use-local"
import { useUrlParams } from "@/lib/policy/url-state"
import { usePolicy } from "@/lib/policy/use-policy"
import { BillText } from "@/components/bill-text"
import type { CodeViewHandle, Match } from "@/components/policy/code-view"
import { Button } from "@govblock/ui/components/nova/button"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

// A bill's text as a file: the file view GitHub gives a source file, put to a
// bill. Read (the standard layout) or Code (CodeMirror), a history strip of
// the versions like commits on a file, Diff against the version before,
// unified or split, an outline of sections, references in this file, and
// search in three scopes — this bill, this session, all of govblock.
//
// Two rows above the text, the way Brendan laid them out in the browser on
// 2026-09-03. The first is which version and how to view it: the history
// chips at the left, Read | Code, Diff, Outline and the file actions at the
// right. The second is finding and which tab: the search box at the left, and
// whatever tabs the host hands in at the right. The file's name is the
// breadcrumb's, so nothing here repeats it.
//
// The search box is GitHub's: `/` focuses it, and focusing it drops a panel
// with the scopes as qualifiers — bill:, session:, all: — a Related group the
// host fills (companion bills, amendments), and the syntax tips. Mode, wrap
// and split are remembered in the browser; a link can name them
// (`?text=code&diff=1&split=1`).

const CodeView = dynamic(() => import("@/components/policy/code-view").then((m) => m.CodeView), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-64 rounded-xl" />,
})

export type TextVersion = { document_id: number; version: string | null; chars: number; fetched_at: string | null }

export type PaneBill = { bill_id: number; bill_number: string; title: string; status_desc?: string | null; last_action_date?: string | null; committee?: string | null }

/** A row in the search panel's Related group: a companion bill, an amendment. */
export type Related = { label: string; action: string; onClick: () => void }

type SearchAnswer = {
  bills: { bill_id: number; bill_number: string; title: string; status_desc: string | null; last_action_date: string | null; state: string }[]
  texts: { bill_id: number; document_id: number; state: string; bill_number: string; title: string; snippet: string }[]
}

type Scope = "bill" | "session" | "all"
type Panel = "outline" | "references" | "results" | null

// ts_headline marks matches with <b>; nothing else from the database is markup.
const safeSnippet = (html: string) => html.replace(/<(?!\/?b>)/g, "&lt;")

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function BillTextPane({
  state,
  session,
  sessionTitle,
  bill,
  versions,
  current,
  onChoose,
  onOpenBill,
  tabs,
  related,
}: {
  state: string
  session: number | null
  sessionTitle: string
  bill: PaneBill
  /** Newest first. */
  versions: TextVersion[]
  /** The version shown; null means the newest. */
  current: number | null
  onChoose: (documentId: number) => void
  /** A result from another bill: open it (in the tree, or in a new tab). */
  onOpenBill?: (billId: number, documentId?: number) => void
  /** The file's tabs, drawn at the right of the search row. */
  tabs?: React.ReactNode
  /** What the search panel offers beside the scopes. */
  related?: Related[]
}) {
  const url = useUrlParams(["text", "diff", "split"] as const)
  const [modePicked, setMode] = useLocal<"read" | "code">("govblock:documents:mode", "read")
  const mode = url.text === "code" || url.text === "read" ? url.text : modePicked
  const [wrap, setWrap] = useLocal("govblock:documents:wrap", true)
  const [splitPicked, setSplit] = useLocal<boolean | null>("govblock:documents:split", null)
  const split = splitPicked ?? url.split === "1"
  const [diffPicked, setDiff] = React.useState<boolean | null>(null)
  const diff = diffPicked ?? url.diff === "1"
  const [query, setQuery] = React.useState("")
  const [scope, setScope] = React.useState<Scope>("bill")
  const [panel, setPanel] = React.useState<Panel>(null)
  const [matches, setMatches] = React.useState<Match[]>([])
  const [layout, setLayout] = React.useState<BillLayout | null>(null)
  const [results, setResults] = React.useState<{ q: string; scope: Scope; answer: SearchAnswer | null; loading: boolean } | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  // The outline's hover lights the line it points at; a click keeps it lit.
  const [target, setTarget] = React.useState<number | null>(null)
  const [hover, setHover] = React.useState<number | null>(null)
  const highlight = hover ?? target
  const [tips, setTips] = React.useState(false)
  const code = React.useRef<CodeViewHandle>(null)
  const input = React.useRef<HTMLInputElement>(null)

  // `/` focuses the search box, as on GitHub.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if ((t instanceof HTMLElement && t.isContentEditable) || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      e.preventDefault()
      input.current?.focus()
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const shown = versions.find((v) => v.document_id === current) ?? versions[0]
  const previous = shown ? versions[versions.findIndex((v) => v.document_id === shown.document_id) + 1] : undefined

  const { data: doc } = usePolicy<{ text?: string }>(shown ? "text" : null, { state }, { id: bill.bill_id, document: shown?.document_id })
  const { data: prior } = usePolicy<{ text?: string }>(diff && previous ? "text" : null, { state }, { id: bill.bill_id, document: previous?.document_id })
  const text = doc?.text ?? null
  const readLayout = React.useMemo(() => (mode === "read" && text ? layoutBillText(printChangeMarks(text)) : null), [mode, text])
  const outline = (mode === "code" ? layout : readLayout)?.headings ?? []

  React.useEffect(() => {
    if (scope === "bill" || !query.trim()) return
    const q = query.trim()
    const params = new URLSearchParams({ q, state, limit: "20", text: "1" })
    if (session) params.set("session", String(session))
    if (scope === "all") params.set("all", "1")
    const timer = window.setTimeout(() => {
      setResults({ q, scope, answer: null, loading: true })
      setPanel("results")
      void fetch(`/api/policy/search?${params}`)
        .then((r) => (r.ok ? (r.json() as Promise<SearchAnswer>) : null))
        .then((answer) => setResults((r) => (r && r.q === q && r.scope === scope ? { ...r, answer, loading: false } : r)))
        .catch(() => setResults((r) => (r && r.q === q ? { ...r, answer: null, loading: false } : r)))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [query, scope, state, session])

  const onMatches = React.useCallback((found: Match[]) => setMatches(found), [])
  const onLayout = React.useCallback((l: BillLayout) => setLayout(l), [])
  const readMatches = React.useMemo(() => {
    if (mode !== "read" || !readLayout || !query.trim()) return []
    const q = query.trim().toLowerCase()
    return readLayout.lines.flatMap((line, index) => (line.text.toLowerCase().includes(q) ? [{ line: index, from: 0, to: 0, text: line.text }] : [])).slice(0, 500)
  }, [mode, readLayout, query])
  const references = mode === "code" ? matches : readMatches

  const goto = (line: number) => {
    setTarget(line)
    if (mode === "code") code.current?.goto(line)
    else document.querySelector(`[data-slot="bill-text"] > div:nth-child(${line + 1})`)?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  const openResult = (billId: number, documentId?: number) => {
    if (billId === bill.bill_id && documentId && versions.some((v) => v.document_id === documentId)) onChoose(documentId)
    else if (onOpenBill) onOpenBill(billId, documentId)
    else window.open(`/docs/bills/${billId}?state=${state}`, "_blank", "noopener")
  }

  const toggle = (value: string, active: boolean, onClick: () => void, label = value) => (
    <button key={value} type="button" data-active={active} onClick={onClick} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
      {label}
    </button>
  )
  const modeToggle = (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {toggle("read", mode === "read", () => setMode("read"), "Read")}
      {toggle("code", mode === "code", () => setMode("code"), "Code")}
    </div>
  )
  const scopes: { value: Scope; label: string }[] = [
    { value: "bill", label: "Search in this bill" },
    { value: "session", label: "Search in this session" },
    { value: "all", label: "Search all of govblock" },
  ]
  const qualifier = (s: Scope) => (s === "bill" ? `bill:${bill.bill_number}` : s === "session" ? `session:${state}/${session ?? ""}` : "all:govblock")

  if (!shown) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No text on file for {bill.bill_number} yet.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Row one: which version, and how to view it. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <span className="mr-1 shrink-0 text-xs text-muted-foreground">History</span>
          {versions.map((v, index) => (
            <button key={v.document_id} type="button" data-active={v.document_id === shown.document_id} onClick={() => onChoose(v.document_id)} className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted data-[active=true]:bg-foreground data-[active=true]:text-background" title={`${fmtNumber(v.chars)} characters${v.fetched_at ? ` · fetched ${fmtDate(String(v.fetched_at).slice(0, 10))}` : ""}`}>
              <span className="font-mono opacity-70">{String(versions.length - index).padStart(2, "0")}</span>
              {v.version ?? "Original"}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {modeToggle}
          {mode === "code" && (
            <>
              <Button variant={diff ? "default" : "outline"} size="sm" disabled={!previous} title={previous ? `Against ${previous.version ?? "the previous version"}` : "This is the first version on file"} onClick={() => setDiff((d) => !(d ?? url.diff === "1"))}>
                Diff
              </Button>
              {diff && previous && (
                <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                  {toggle("unified", !split, () => setSplit(false), "Unified")}
                  {toggle("split", split, () => setSplit(true), "Split")}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setWrap((w) => !w)} title="Line wrap mode">
                {wrap ? "Soft wrap" : "No wrap"}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setPanel((p) => (p === "outline" ? null : "outline"))} data-active={panel === "outline"} className="data-[active=true]:bg-muted">
            Outline{outline.length ? ` · ${outline.length}` : ""}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy the text"
            disabled={!text}
            onClick={() => {
              if (!text) return
              void navigator.clipboard?.writeText(text)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Download the text" disabled={!text} onClick={() => text && download(`${bill.bill_number}-${(shown.version ?? "original").replace(/\s+/g, "-").toLowerCase()}.txt`, text)}>
            <DownloadIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Open the bill in a new tab" nativeButton={false} render={<a href={`/docs/bills/${bill.bill_id}?state=${state}`} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon />
          </Button>
        </div>
      </div>

      {/* Row two: finding, and which tab. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="relative min-w-64 flex-1">
          <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background pr-8 pl-2.5 text-sm focus-within:ring-1 focus-within:ring-ring">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="shrink-0 rounded bg-primary/10 px-1 font-mono text-xs text-primary">{qualifier(scope)}</span>
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (scope === "bill" && e.target.value.trim()) setPanel("references")
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("")
                  input.current?.blur()
                }
                // Enter runs the search and puts the panel away, as GitHub's does.
                if (e.key === "Enter") {
                  e.preventDefault()
                  setFocused(false)
                  input.current?.blur()
                  if (query.trim()) setPanel(scope === "bill" ? "references" : "results")
                }
                if (e.key === "Backspace" && !query && scope !== "bill") setScope("bill")
              }}
              placeholder={scope === "bill" ? "Find in this file…" : scope === "session" ? `Search ${sessionTitle || "this session"}…` : "Search every jurisdiction…"}
              className="min-w-0 flex-1 bg-transparent outline-none"
              aria-label="Search"
            />
          </div>
          {query && (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          )}
          {query.trim() && scope === "bill" && !focused && <span className="absolute top-1/2 right-8 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">{fmtNumber(references.length)}</span>}

          {focused && (
            <div className="absolute top-full left-0 z-30 mt-1 w-full min-w-96 rounded-lg border bg-popover text-popover-foreground shadow-lg" onMouseDown={(e) => e.preventDefault()}>
              <div className="py-1">
                {scopes.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      setScope(s.value)
                      if (query.trim()) setPanel(s.value === "bill" ? "references" : "results")
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <span className="font-mono text-primary">{qualifier(s.value)}</span>
                      {query.trim() && <span className="ml-1.5">{query.trim()}</span>}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{s.label}</span>
                  </button>
                ))}
              </div>
              {related && related.length > 0 && (
                <div className="border-t py-1">
                  <div className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Related</div>
                  {related.map((r) => (
                    <button key={`${r.label}-${r.action}`} type="button" onClick={r.onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
                      <span className="truncate font-mono">{r.label}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{r.action}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setTips((t) => !t)}>
                  Search syntax tips
                </button>
                <a href="?at=inbox" className="text-primary hover:underline">
                  Give feedback
                </a>
              </div>
              {tips && (
                <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    <span className="font-mono text-primary">bill:</span> finds in this file. <span className="font-mono text-primary">session:</span> searches every bill of the session, text included. <span className="font-mono text-primary">all:</span> searches every jurisdiction. Backspace on an empty box narrows back to the file; Escape clears it.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {tabs && <div className="ml-auto flex shrink-0 items-center">{tabs}</div>}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {text === null ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
          ) : mode === "code" ? (
            <CodeView ref={code} text={text} original={diff ? (prior?.text ?? null) : null} diff={diff && !!prior?.text} split={split} wrap={wrap} query={scope === "bill" ? query : ""} highlight={highlight} onMatches={onMatches} onLayout={onLayout} />
          ) : (
            <div className="h-full overflow-y-auto p-4">
              <BillText text={text} version={shown.version} date={bill.last_action_date} highlight={highlight} />
            </div>
          )}
        </div>

        {panel && (
          <aside className="flex w-80 shrink-0 flex-col border-l">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs font-medium">
              {panel === "outline" ? `Outline · ${outline.length}` : panel === "references" ? `${fmtNumber(references.length)} references` : results ? (results.loading ? "Searching…" : `Results · ${scopes.find((s) => s.value === results.scope)?.label}`) : "Results"}
              <button type="button" aria-label="Close" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setPanel(null)}>
                <XIcon className="size-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {panel === "outline" &&
                (outline.length ? (
                  outline.map((h) => (
                    <button key={`${h.line}-${h.label}`} type="button" data-active={target === h.line} onMouseEnter={() => setHover(h.line)} onMouseLeave={() => setHover(null)} onClick={() => goto(h.line)} className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-muted data-[active=true]:bg-yellow-300/40">
                      <span className="w-10 shrink-0 text-right font-mono text-muted-foreground tabular-nums">{h.line + 1}</span>
                      <span className="truncate">{h.label}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-4 text-xs text-muted-foreground">No sections recognised in this text.</p>
                ))}
              {panel === "references" &&
                (references.length ? (
                  references.map((m, i) => (
                    <button key={`${m.line}-${i}`} type="button" data-active={target === m.line} onMouseEnter={() => setHover(m.line)} onMouseLeave={() => setHover(null)} onClick={() => goto(m.line)} className="flex w-full items-start gap-2 px-3 py-1 text-left text-xs hover:bg-muted data-[active=true]:bg-yellow-300/40">
                      <span className="w-10 shrink-0 text-right font-mono text-muted-foreground tabular-nums">{m.line + 1}</span>
                      <span className="truncate font-mono">{m.text.trim()}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-4 text-xs text-muted-foreground">{query.trim() ? "No matches in this file." : "Type to find in this file."}</p>
                ))}
              {panel === "results" && results && (
                <>
                  {results.answer?.texts.map((t) => (
                    <button key={`t-${t.document_id}`} type="button" onClick={() => openResult(t.bill_id, t.document_id)} className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-muted">
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-medium">{t.bill_number}</span>
                        <span className="truncate text-muted-foreground">{truncate(t.title, 60)}</span>
                        {results.scope === "all" && <span className="ml-auto shrink-0 text-muted-foreground">{t.state}</span>}
                      </span>
                      <span className="line-clamp-2 text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground" dangerouslySetInnerHTML={{ __html: safeSnippet(t.snippet) }} />
                    </button>
                  ))}
                  {results.answer?.bills
                    .filter((b) => !results.answer?.texts.some((t) => t.bill_id === b.bill_id))
                    .map((b) => (
                      <button key={`b-${b.bill_id}`} type="button" onClick={() => openResult(b.bill_id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted">
                        <span className="font-mono font-medium">{b.bill_number}</span>
                        <span className="truncate text-muted-foreground">{truncate(b.title, 70)}</span>
                        {results.scope === "all" && <span className="ml-auto shrink-0 text-muted-foreground">{b.state}</span>}
                      </button>
                    ))}
                  {!results.loading && !results.answer?.texts.length && !results.answer?.bills.length && <p className="px-3 py-4 text-xs text-muted-foreground">Nothing matches “{results.q}”.</p>}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
