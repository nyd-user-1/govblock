"use client"

import * as React from "react"
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CircleUserRoundIcon, CopyIcon, FileTextIcon, PanelLeftIcon, SearchIcon, SettingsIcon } from "lucide-react"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { dateOfRecord } from "@/lib/policy/date-of-record"
import { useDocPref } from "@/lib/policy/doc-prefs"
import { versionId } from "@/lib/policy/forks"
import { handleFor } from "@/lib/policy/handle"
import { lineDiff } from "@/lib/policy/line-diff"
import type { Bill } from "@/lib/policy/types"
import { ago } from "@/components/create/timeline"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { DiffView, type DiffComment, type LineRef } from "@/components/policy/diff-view"
import { FlagChip } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Button as Ny4Button } from "@govblock/ui/components/ny4/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { useSidebar } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// A bill's Changes tab: GitHub's commit page, with the versions as the files
// changed. Laid out the way Brendan set it in the browser on 2026-09-04
// (ironic-version-1.html): the card first — the version's message as its
// title with the `Version 02` chip beside it, the description under it, and
// a footer of parent · document | N versions · +added −deleted — then the
// date of record and Browse text under the card, then GitHub's toolbar,
// then every version as a collapsible section, newest first, each a diff
// against the version before it.
//
// Two kinds of section. An official version wears the jurisdiction's flag.
// A version someone proposed in a fork sits indented under the official
// version it changes, with an avatar and the author's handle, so the
// boundary between the record and what people made of it is always
// visible; the gear can hide the proposed ones for a clean look at the
// official diffs. Every text is fetched, because the bar on a closed section
// needs the count; the counts are computed one at a time when the browser
// is idle, and the diff inside a section is built only when it is opened.

type Stats = { added: number; deleted: number }

const COMMENTS_EVENT = "govblock:comments"

function useComments(key: string) {
  const subscribe = React.useCallback((notify: () => void) => {
    window.addEventListener(COMMENTS_EVENT, notify)
    window.addEventListener("storage", notify)
    return () => {
      window.removeEventListener(COMMENTS_EVENT, notify)
      window.removeEventListener("storage", notify)
    }
  }, [])
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) ?? "[]"
      } catch {
        return "[]"
      }
    },
    () => "[]"
  )
  const comments = React.useMemo(() => {
    try {
      return JSON.parse(raw) as DiffComment[]
    } catch {
      return []
    }
  }, [raw])
  const add = React.useCallback(
    (at: LineRef, body: string) => {
      const next = [...comments, { id: `${Date.now()}`, side: at.side, line: at.line, body, author: "you", at: new Date().toISOString() }]
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Private mode: the comment lives for this render only.
      }
      window.dispatchEvent(new Event(COMMENTS_EVENT))
    },
    [key, comments]
  )
  return { comments, add }
}

export function DiffBar({ added, deleted, className }: Stats & { className?: string }) {
  const total = added + deleted
  const green = total ? Math.round((5 * added) / total) : 0
  const red = total ? Math.min(5 - green, deleted ? Math.max(1, 5 - green) : 0) : 0
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs tabular-nums", className)}>
      {added > 0 && <span className="text-green-600 dark:text-green-500">+{fmtNumber(added)}</span>}
      {deleted > 0 && <span className="text-red-600 dark:text-red-500">−{fmtNumber(deleted)}</span>}
      <span aria-hidden className="inline-flex gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={cn("size-2.5 rounded-[2px]", i < green ? "bg-green-600 dark:bg-green-500" : i < green + red ? "bg-red-600 dark:bg-red-500" : "bg-muted-foreground/25")} />
        ))}
      </span>
    </span>
  )
}

function useTexts(state: string, billId: number, versions: TextVersion[]) {
  const [texts, setTexts] = React.useState<Record<number, string>>({})
  const asked = React.useRef(new Set<number>())
  const mounted = React.useRef(true)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  React.useEffect(() => {
    for (const v of versions) {
      if (v.commit || asked.current.has(v.document_id)) continue
      asked.current.add(v.document_id)
      void fetch(`/api/policy/text?state=${state}&id=${billId}&document=${v.document_id}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ text?: string }>) : null))
        .then((doc) => mounted.current && setTexts((t) => ({ ...t, [v.document_id]: doc?.text ?? "" })))
        .catch(() => mounted.current && setTexts((t) => ({ ...t, [v.document_id]: "" })))
    }
  }, [state, billId, versions])
  return React.useMemo<Record<number, string>>(() => ({ ...texts, ...Object.fromEntries(versions.filter((v) => v.commit).map((v) => [v.document_id, v.commit!.text])) }), [texts, versions])
}

/** Line counts per version, computed one at a time while the browser is idle — a million-character act diffs in the background, not on the click. */
function useIdleStats(pairs: { id: number; before: string | null; after: string | null }[]) {
  const [stats, setStats] = React.useState<Record<number, Stats>>({})
  const done = React.useRef(new Set<number>())
  React.useEffect(() => {
    const todo = pairs.filter((p) => p.before !== null && p.after !== null && !done.current.has(p.id))
    if (!todo.length) return
    let cancelled = false
    const idle: (cb: () => void) => void = typeof window.requestIdleCallback === "function" ? (cb) => void window.requestIdleCallback(cb, { timeout: 500 }) : (cb) => void window.setTimeout(cb, 16)
    const step = (i: number) => {
      if (cancelled || i >= todo.length) return
      const p = todo[i]
      const d = lineDiff(p.before!, p.after!)
      done.current.add(p.id)
      setStats((s) => ({ ...s, [p.id]: { added: d.added, deleted: d.deleted } }))
      idle(() => step(i + 1))
    }
    idle(() => step(0))
    return () => {
      cancelled = true
    }
  }, [pairs])
  return stats
}

function VersionDiff({ state, billId, documentId, before, after, split, query, compact, hideComments, ignoreWhitespace }: { state: string; billId: number; documentId: number; before: string; after: string; split: boolean; query: string; compact: boolean; hideComments: boolean; ignoreWhitespace: boolean }) {
  const { comments, add } = useComments(`govblock:comments:${state}:${billId}:${documentId}`)
  return <DiffView before={before} after={after} layout={split ? "split" : "unified"} query={query} anchor={`diff-${documentId}-`} comments={comments} onComment={add} compact={compact} hideComments={hideComments} ignoreWhitespace={ignoreWhitespace} />
}

/** The official version a commit changes: its document parent, or the nearest official ancestor through commit parents. */
function officialParentOf(v: TextVersion, versions: TextVersion[]): number | null {
  let cur: TextVersion | undefined = v
  for (let i = 0; i < 50 && cur?.commit; i++) {
    if (cur.commit.parent_document_id) return cur.commit.parent_document_id
    const pid: number | null | undefined = cur.commit.parent_commit_id
    cur = pid ? versions.find((x) => x.commit?.id === pid) : undefined
  }
  return null
}

export function BillChanges({ state, bill, versions, doc, onDoc, onOpenText }: { state: string; bill: Bill; /** Newest first. */ versions: TextVersion[]; doc: number | null; onDoc: (documentId: number) => void; onOpenText: (documentId: number) => void }) {
  const texts = useTexts(state, bill.bill_id, versions)
  const [splitPicked, setSplit] = useDocPref<boolean | null>("split", null)
  const split = splitPicked ?? false
  const [hideComments, setHideComments] = useDocPref("minimize-comments", false)
  const [ignoreWhitespace, setIgnoreWhitespace] = useDocPref("hide-whitespace", false)
  const [compact, setCompact] = useDocPref("compact", false)
  const [hideProposed, setHideProposed] = useDocPref("hide-proposed", false)
  const { toggleSidebar } = useSidebar()
  const [query, setQuery] = React.useState("")
  const [copied, setCopied] = React.useState<number | null>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = React.useState(false)

  const official = React.useMemo(() => versions.filter((v) => !v.commit), [versions])
  const proposed = React.useMemo(() => versions.filter((v) => v.commit), [versions])
  const picked = versions.find((v) => v.document_id === doc) ?? official[0] ?? versions[0]
  const [openPicked, setOpen] = React.useState<Record<number, boolean>>({})
  const isOpen = (id: number) => openPicked[id] ?? id === picked?.document_id

  // What each version is diffed against: an official version against the
  // official one before it; a proposed version against its own parent.
  const baseOf = React.useCallback(
    (v: TextVersion): TextVersion | undefined => {
      if (v.commit) {
        if (v.commit.parent_commit_id) return versions.find((x) => x.commit?.id === v.commit!.parent_commit_id)
        if (v.commit.parent_document_id) return versions.find((x) => x.document_id === v.commit!.parent_document_id)
        return undefined
      }
      return official[official.findIndex((x) => x.document_id === v.document_id) + 1]
    },
    [versions, official]
  )

  const pairs = React.useMemo(
    () =>
      versions.map((v) => {
        const base = baseOf(v)
        const after = texts[v.document_id] ?? null
        const before = base ? (texts[base.document_id] ?? null) : ""
        return { id: v.document_id, before, after }
      }),
    [versions, texts, baseOf]
  )
  const statsOf = useIdleStats(pairs)

  const nth = (v: TextVersion) => String(official.length - official.findIndex((x) => x.document_id === v.document_id)).padStart(2, "0")
  const label = (v: TextVersion) => (v.commit ? v.commit.message.toLowerCase() : `${(v.version ?? "original").toLowerCase()} ${nth(v)}`)

  if (!picked) return <p className="py-16 text-center text-sm text-muted-foreground">No text on file for {bill.bill_number} yet.</p>
  const pickedStats = statsOf[picked.document_id]
  const pickedBase = baseOf(picked)
  const pickedDate = picked.commit ? null : dateOfRecord(picked, bill)

  const section = (v: TextVersion, nested: boolean) => {
    const open = isOpen(v.document_id)
    const base = baseOf(v)
    const text = texts[v.document_id]
    const before = base ? texts[base.document_id] : ""
    const s = statsOf[v.document_id]
    return (
      <section key={v.document_id} data-open={open} className={cn("overflow-hidden rounded-lg border", nested && "ml-12")}>
        <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              setOpen((o) => ({ ...o, [v.document_id]: !open }))
              if (!open) onDoc(v.document_id)
            }}
            className="flex min-w-0 items-center gap-2 text-sm hover:underline"
          >
            {v.commit ? <CircleUserRoundIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : <FlagChip state={state} />}
            {open ? <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate font-mono">{label(v)}</span>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy this version's text"
            disabled={!text}
            onClick={() => {
              if (!text) return
              void navigator.clipboard?.writeText(text)
              setCopied(v.document_id)
              window.setTimeout(() => setCopied(null), 1500)
            }}
          >
            {copied === v.document_id ? <CheckIcon /> : <CopyIcon />}
          </Button>
          <span className="ml-auto flex items-center gap-2">
            {s ? <DiffBar {...s} /> : <Skeleton className="h-3 w-24" />}
            <Button variant="ghost" size="icon-sm" aria-label="Browse the text at this version" onClick={() => onOpenText(v.document_id)}>
              <FileTextIcon />
            </Button>
          </span>
        </div>
        {open && (
          <div className="border-t">
            {text == null || before == null ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
                ))}
              </div>
            ) : (
              <VersionDiff state={state} billId={bill.bill_id} documentId={v.document_id} before={base ? before : ""} after={text} split={split} query={query} compact={compact} hideComments={hideComments} ignoreWhitespace={ignoreWhitespace} />
            )}
          </div>
        )}
        {!open && (
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {v.commit ? (
              <>
                <span className="font-mono text-primary">{v.commit.owner ? handleFor(v.commit.owner) : v.commit.author}</span> · {truncate(bill.title, 80)}
              </>
            ) : (
              `${bill.session_title ?? ""}${bill.session_title ? " · " : ""}${truncate(bill.title, 80)}`
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}>
      {/* The version's card, as a commit's header, Brendan's way. */}
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <div className="mb-3 rounded-lg border">
          <div className="px-4 py-3">
            <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold">
              <span className="min-w-0">{picked.commit ? picked.commit.message : `${picked.version ?? "Original"}: ${bill.bill_number} — ${bill.title}`}</span>
              <span className="rounded bg-muted px-1.5 font-mono text-base font-medium">{picked.commit ? `commit ${picked.commit.id}` : `Version ${nth(picked)}`}</span>
            </h2>
            {picked.commit ? picked.commit.description && <p className="mt-2 max-w-3xl font-mono text-xs whitespace-pre-wrap text-muted-foreground">{picked.commit.description}</p> : bill.description && bill.description !== bill.title && <p className="mt-2 max-w-3xl font-mono text-xs whitespace-pre-wrap text-muted-foreground">{bill.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              {pickedBase ? (
                <>
                  1 parent <span className="font-mono text-primary">{versionId(pickedBase)}</span> · {picked.commit ? "" : "document "}
                  <span className="font-mono text-primary">{versionId(picked)}</span>
                </>
              ) : (
                <>
                  Initial document <span className="font-mono text-primary">{versionId(picked)}</span>
                </>
              )}
            </span>
            <span className="ml-auto flex items-center gap-3">
              <span className="font-medium text-foreground">
                {official.length} version{official.length === 1 ? "" : "s"}
                {proposed.length ? ` · ${proposed.length} proposed` : ""}
              </span>
              {pickedStats && <DiffBar {...pickedStats} />}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm text-muted-foreground">{picked.commit ? `${picked.commit.owner ? handleFor(picked.commit.owner) : picked.commit.author} committed ${ago(picked.fetched_at)}` : fmtDate(pickedDate) || "Date of record unknown"}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onOpenText(picked.document_id)}>
            <FileTextIcon className="size-3.5" /> Browse text
          </Button>
        </div>
      </div>

      {/* GitHub's toolbar: the rail toggle, Top while scrolled, search within the text, and the gear. */}
      <div className="sticky top-0 z-10 mx-auto flex w-full max-w-6xl items-center gap-2 bg-background px-6 py-3">
        <Button variant="outline" size="icon-sm" aria-label="Toggle the tree" onClick={toggleSidebar}>
          <PanelLeftIcon />
        </Button>
        {scrolled && (
          <Button variant="ghost" size="sm" onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}>
            <ArrowUpIcon className="size-3.5" /> Top
          </Button>
        )}
        <div className="flex h-8 w-80 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm focus-within:ring-1 focus-within:ring-ring">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search within the text" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Search within the text" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Ny4Button variant="outline" size="icon" className="size-8" aria-label="Diff settings">
              <SettingsIcon />
            </Ny4Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="min-w-60 rounded-lg">
            <DropdownMenuLabel className="text-muted-foreground">Layout</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={!split} onCheckedChange={() => setSplit(false)}>
              Unified
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={split} onCheckedChange={() => setSplit(true)}>
              Split
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={hideComments} onCheckedChange={(v) => setHideComments(!!v)}>
              Minimize comments
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={hideProposed} onCheckedChange={(v) => setHideProposed(!!v)}>
              Hide proposed versions
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={ignoreWhitespace} onCheckedChange={(v) => setIgnoreWhitespace(!!v)}>
              Hide whitespace
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={compact} onCheckedChange={(v) => setCompact(!!v)}>
              Compact line height
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* One section per official version, newest first; under each, what people proposed on it. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 pb-6">
        {official.map((v) => (
          <React.Fragment key={v.document_id}>
            {section(v, false)}
            {!hideProposed && proposed.filter((p) => officialParentOf(p, versions) === v.document_id).map((p) => section(p, true))}
          </React.Fragment>
        ))}
        {!hideProposed && proposed.filter((p) => officialParentOf(p, versions) === null).map((p) => section(p, true))}
      </div>
      <p className="sr-only">{doc ? `Showing version ${doc}` : ""}</p>
    </div>
  )
}
