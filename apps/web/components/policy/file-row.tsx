"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, HistoryIcon, PencilIcon, SearchIcon, SquareCodeIcon, XIcon } from "lucide-react"

import { fmtBill, fmtNumber, truncate } from "@/lib/format"
import { Button as Ny4Button } from "@govblock/ui/components/ny4/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { Button } from "@govblock/ui/components/nova/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// GitHub's file row, lifted out of bill-text-pane.tsx (Brendan, 2026-09-14:
// the Git view's header on every Typeset view). One row: the search box with
// its scopes at the left; at the right the fork chip, Raw, copy and download
// as one group, the pencil with its menu, the outline toggle and History.
// What the row finds in, what it copies and what its panels show belong to
// the view that wears it: the Git view's CodeMirror, or the page under
// Typeset's other views (typeset-file-chrome.tsx).

/** A row in the search panel's Related group: a companion bill, an amendment. */
export type Related = { label: string; action: string; onClick: () => void }

export type SearchScope = "bill" | "session" | "all"

export type SearchAnswer = {
  bills: { bill_id: number; bill_number: string; title: string; status_desc: string | null; last_action_date: string | null; state: string }[]
  texts: { bill_id: number; document_id: number; state: string; bill_number: string; title: string; snippet: string }[]
}

export type SearchResults = { q: string; scope: SearchScope; answer: SearchAnswer | null; loading: boolean }

export const SEARCH_SCOPES: { value: SearchScope; label: string }[] = [
  { value: "bill", label: "Search in this bill" },
  { value: "session", label: "Search in this session" },
  { value: "all", label: "Search all of govblock" },
]

// ts_headline marks matches with <b>; nothing else from the database is markup.
const safeSnippet = (html: string) => html.replace(/<(?!\/?b>)/g, "&lt;")

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** "256 lines (236 loc) · 13.7 KB", as GitHub sizes a file. */
export function sizeOf(text: string | null) {
  if (!text) return null
  const lines = text.split("\n")
  const loc = lines.filter((l) => l.trim()).length
  const kb = new Blob([text]).size / 1024
  return `${fmtNumber(lines.length)} lines (${fmtNumber(loc)} loc) · ${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`
}

/** The session and all-of-govblock scopes, run 400 ms after typing stops; `onRun` is told when a search starts. */
export function useScopedSearch({ query, scope, state, session, onRun }: { query: string; scope: SearchScope; state: string; session: number | null; onRun?: () => void }) {
  const [results, setResults] = React.useState<SearchResults | null>(null)
  const run = React.useRef(onRun)
  run.current = onRun
  React.useEffect(() => {
    if (scope === "bill" || !query.trim()) return
    const q = query.trim()
    const params = new URLSearchParams({ q, state, limit: "20", text: "1" })
    if (session) params.set("session", String(session))
    if (scope === "all") params.set("all", "1")
    const timer = window.setTimeout(() => {
      setResults({ q, scope, answer: null, loading: true })
      run.current?.()
      void fetch(`/api/policy/search?${params}`)
        .then((r) => (r.ok ? (r.json() as Promise<SearchAnswer>) : null))
        .then((answer) => setResults((r) => (r && r.q === q && r.scope === scope ? { ...r, answer, loading: false } : r)))
        .catch(() => setResults((r) => (r && r.q === q ? { ...r, answer: null, loading: false } : r)))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [query, scope, state, session])
  return results
}

export const resultsTitle = (results: SearchResults | null) => (results ? (results.loading ? "Searching…" : `Results · ${SEARCH_SCOPES.find((s) => s.value === results.scope)?.label}`) : "Results")

/** The session and all-of-govblock answers, in the pane's aside. */
export function ResultsList({ results, state, onOpen }: { results: SearchResults; state: string; onOpen: (billId: number, documentId?: number) => void }) {
  return (
    <>
      {results.answer?.texts.map((t) => (
        <button key={`t-${t.document_id}`} type="button" onClick={() => onOpen(t.bill_id, t.document_id)} className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-muted">
          <span className="flex items-center gap-2">
            <span className="font-mono font-medium">{fmtBill(t.bill_number, state)}</span>
            <span className="truncate text-muted-foreground">{truncate(t.title, 60)}</span>
            {results.scope === "all" && <span className="ml-auto shrink-0 text-muted-foreground">{t.state}</span>}
          </span>
          <span className="line-clamp-2 text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground" dangerouslySetInnerHTML={{ __html: safeSnippet(t.snippet) }} />
        </button>
      ))}
      {results.answer?.bills
        .filter((b) => !results.answer?.texts.some((t) => t.bill_id === b.bill_id))
        .map((b) => (
          <button key={`b-${b.bill_id}`} type="button" onClick={() => onOpen(b.bill_id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted">
            <span className="font-mono font-medium">{b.bill_number}</span>
            <span className="truncate text-muted-foreground">{truncate(b.title, 70)}</span>
            {results.scope === "all" && <span className="ml-auto shrink-0 text-muted-foreground">{b.state}</span>}
          </button>
        ))}
      {!results.loading && !results.answer?.texts.length && !results.answer?.bills.length && <p className="px-3 py-4 text-xs text-muted-foreground">Nothing matches “{results.q}”.</p>}
    </>
  )
}

export function FileRow({
  qualifiers,
  sessionTitle,
  query,
  onQuery,
  scope,
  onScope,
  matchCount,
  onSubmit,
  onClear,
  related,
  onSeeAllRelated,
  size,
  history,
  rawHref,
  text,
  fileName,
  onEdit,
  pageHref,
  pageLabel = "Open the bill's page",
  outlineCount,
  outlineOpen,
  onOutline,
  historyOpen,
  onHistory,
  slashFocuses = true,
}: {
  /** The qualifier chip for each scope: bill:H.R.6644, session:US/119, all:govblock. */
  qualifiers: Record<SearchScope, string>
  sessionTitle: string
  query: string
  onQuery: (query: string) => void
  scope: SearchScope
  onScope: (scope: SearchScope) => void
  /** Matches in this file, shown beside the box when it is not focused. */
  matchCount: number
  /** Enter, or a scope picked with words in the box. */
  onSubmit: (scope: SearchScope) => void
  onClear: () => void
  related?: Related[]
  onSeeAllRelated?: () => void
  /** Drawn in the row only when no footer takes it. */
  size?: string | null
  /** The fork chip, beside the file buttons. */
  history?: React.ReactNode
  rawHref: string
  text: string | null
  fileName: string
  /** The pencil. Absent, the pencil is disabled. */
  onEdit?: () => void
  pageHref?: string
  pageLabel?: string
  outlineCount: number
  outlineOpen: boolean
  onOutline: () => void
  historyOpen: boolean
  onHistory: () => void
  /** `/` focuses the box, as on GitHub. */
  slashFocuses?: boolean
}) {
  const [copied, setCopied] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [tips, setTips] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!slashFocuses) return
    const down = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if ((t instanceof HTMLElement && t.isContentEditable) || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      e.preventDefault()
      input.current?.focus()
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [slashFocuses])

  return (
    <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
      <div className="relative min-w-64 flex-1">
        <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background pr-8 pl-2.5 text-sm focus-within:ring-1 focus-within:ring-ring">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 rounded bg-primary/10 px-1 font-mono text-xs text-primary">{qualifiers[scope]}</span>
          <input
            ref={input}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onQuery("")
                input.current?.blur()
              }
              // Enter runs the search and puts the panel away, as GitHub's does.
              if (e.key === "Enter") {
                e.preventDefault()
                setFocused(false)
                input.current?.blur()
                if (query.trim()) onSubmit(scope)
              }
              if (e.key === "Backspace" && !query && scope !== "bill") onScope("bill")
            }}
            placeholder={scope === "bill" ? "Find in this file…" : scope === "session" ? `Search ${sessionTitle || "this session"}…` : "Search every jurisdiction…"}
            className="min-w-0 flex-1 bg-transparent outline-none"
            aria-label="Search"
          />
        </div>
        <button
          type="button"
          aria-label="Clear the search"
          onClick={onClear}
          className={cn("absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground", !query && scope === "bill" && "opacity-50")}
        >
          <XIcon className="size-3.5" />
        </button>
        {query.trim() && scope === "bill" && !focused && <span className="absolute top-1/2 right-8 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">{fmtNumber(matchCount)}</span>}

        {focused && (
          <div className="absolute top-full left-0 z-30 mt-1 max-h-[70vh] w-full min-w-96 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg" onMouseDown={(e) => e.preventDefault()}>
            <div className="py-1">
              {SEARCH_SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    onScope(s.value)
                    if (query.trim()) onSubmit(s.value)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    <span className="font-mono text-primary">{qualifiers[s.value]}</span>
                    {query.trim() && <span className="ml-1.5">{query.trim()}</span>}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>
            {related && related.length > 0 && (
              <div className="border-t py-1">
                <div className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Related</div>
                {related.slice(0, 3).map((r, i) => (
                  <button key={`${r.label}-${r.action}-${i}`} type="button" onClick={r.onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="truncate font-mono">{r.label}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{r.action}</span>
                  </button>
                ))}
                {related.length > 3 && onSeeAllRelated && (
                  <button
                    type="button"
                    onClick={() => {
                      onSeeAllRelated()
                      setFocused(false)
                      input.current?.blur()
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-left text-xs text-primary hover:underline"
                  >
                    See all {related.length} related bills
                  </button>
                )}
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
      {size && <span className="shrink-0 font-mono text-xs text-muted-foreground">{size}</span>}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {history}
        <div className="flex items-center overflow-hidden rounded-md border" role="group" aria-label="Raw, copy, download">
          <Button variant="ghost" size="sm" className="rounded-none px-2.5 font-medium" nativeButton={false} render={<a href={rawHref} target="_blank" rel="noreferrer" />}>
            Raw
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-none border-l"
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
          <Button variant="ghost" size="icon-sm" className="rounded-none border-l" aria-label="Download the text" disabled={!text} onClick={() => text && downloadText(fileName, text)}>
            <DownloadIcon />
          </Button>
        </div>
        <div className="flex items-center overflow-hidden rounded-md border" role="group" aria-label="Edit">
          {/* Duplicate to edit (Brendan, 2026-09-11): the pencil opens the reader's own copy in the editor at once. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="rounded-none" aria-label="Duplicate to edit" disabled={!onEdit || !text} onClick={onEdit}>
                  <PencilIcon />
                </Button>
              }
            />
            <TooltipContent side="top" sideOffset={6}>
              Duplicate to edit
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Ny4Button variant="ghost" size="icon" className="size-7 rounded-none border-l" aria-label="More edit options">
                <ChevronDownIcon />
              </Ny4Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="min-w-48 rounded-lg">
              <DropdownMenuItem disabled={!onEdit || !text} onClick={onEdit}>
                <PencilIcon /> Duplicate to edit
              </DropdownMenuItem>
              {pageHref && (
                <DropdownMenuItem asChild>
                  <a href={pageHref} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon /> {pageLabel}
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button variant="outline" size="icon-sm" aria-label={`Outline${outlineCount ? ` · ${outlineCount}` : ""}`} title={`Outline${outlineCount ? ` · ${outlineCount}` : ""}`} onClick={onOutline} data-active={outlineOpen} className="data-[active=true]:bg-muted">
          <SquareCodeIcon />
        </Button>
        <Button variant="ghost" size="sm" data-active={historyOpen} className="font-semibold data-[active=true]:bg-muted" onClick={onHistory}>
          <HistoryIcon className="size-4" /> History
        </Button>
      </div>
    </div>
  )
}
