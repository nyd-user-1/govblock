"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { diff } from "@codemirror/merge"
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon, FileTextIcon, SearchIcon } from "lucide-react"

import { fmtNumber, truncate } from "@/lib/format"
import { useDocPref } from "@/lib/policy/doc-prefs"
import type { Bill } from "@/lib/policy/types"
import { ago } from "@/components/create/timeline"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { Button } from "@govblock/ui/components/nova/button"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { cn } from "@govblock/ui/lib/utils"

// A bill's Changes tab: GitHub's commit page, with the versions as the files
// changed (Brendan, 2026-09-03). The card at the top is the version that was
// clicked — its name, the bill's title, when, and +added −deleted with the
// five-block bar. Under it every version is a collapsible section, newest
// first, each a diff against the version before it; the clicked one is open.
// The first version has nothing before it, so it is shown whole, as GitHub
// shows a new file.
//
// Every text is fetched, because the bar on a closed section needs the count;
// the editor inside a section is built only when it is opened.

const CodeView = dynamic(() => import("@/components/policy/code-view").then((m) => m.CodeView), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-64 rounded-xl" />,
})

type Stats = { added: number; deleted: number }

/** Lines added and deleted between two texts, by CodeMirror's own diff. */
function stats(before: string, after: string): Stats {
  let added = 0
  let deleted = 0
  for (const c of diff(before, after)) {
    const ins = after.slice(c.fromB, c.toB)
    const del = before.slice(c.fromA, c.toA)
    if (ins) added += ins.split("\n").length
    if (del) deleted += del.split("\n").length
  }
  return { added, deleted }
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
      if (asked.current.has(v.document_id)) continue
      asked.current.add(v.document_id)
      void fetch(`/api/policy/text?state=${state}&id=${billId}&document=${v.document_id}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ text?: string }>) : null))
        .then((doc) => mounted.current && setTexts((t) => ({ ...t, [v.document_id]: doc?.text ?? "" })))
        .catch(() => mounted.current && setTexts((t) => ({ ...t, [v.document_id]: "" })))
    }
  }, [state, billId, versions])
  return texts
}

export function BillChanges({ state, bill, versions, doc, onDoc, onOpenText }: { state: string; bill: Bill; /** Newest first. */ versions: TextVersion[]; doc: number | null; onDoc: (documentId: number) => void; onOpenText: (documentId: number) => void }) {
  const texts = useTexts(state, bill.bill_id, versions)
  const [splitPicked, setSplit] = useDocPref<boolean | null>("split", null)
  const split = splitPicked ?? false
  const [wrap] = useDocPref("wrap", true)
  const [fold] = useDocPref("fold", true)
  const [query, setQuery] = React.useState("")
  const [copied, setCopied] = React.useState<number | null>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = React.useState(false)

  const picked = versions.find((v) => v.document_id === doc) ?? versions[0]
  // Open: the picked version, and whatever the reader has opened since.
  const [openPicked, setOpen] = React.useState<Record<number, boolean>>({})
  const isOpen = (id: number) => openPicked[id] ?? id === picked?.document_id

  const previousOf = (v: TextVersion) => versions[versions.findIndex((x) => x.document_id === v.document_id) + 1]
  const statsOf = React.useMemo(() => {
    const out: Record<number, Stats | null> = {}
    for (const v of versions) {
      const after = texts[v.document_id]
      const prev = previousOf(v)
      const before = prev ? texts[prev.document_id] : ""
      out[v.document_id] = after == null || before == null ? null : prev ? stats(before, after) : { added: after ? after.split("\n").length : 0, deleted: 0 }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts, versions])

  const nth = (v: TextVersion) => String(versions.length - versions.findIndex((x) => x.document_id === v.document_id)).padStart(2, "0")
  const label = (v: TextVersion) => `${(v.version ?? "original").toLowerCase()} ${nth(v)}`

  if (!picked) return <p className="py-16 text-center text-sm text-muted-foreground">No text on file for {bill.bill_number} yet.</p>
  const pickedStats = statsOf[picked.document_id]

  return (
    <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}>
      {/* The version's card, as a commit's header. */}
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-semibold">
            Version <span className="rounded bg-muted px-1.5 font-mono text-base">{nth(picked)}</span>
          </h2>
          <span className="text-sm text-muted-foreground">
            {bill.body ?? "The legislature"} · fetched {ago(picked.fetched_at) || "on an unknown date"}
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onOpenText(picked.document_id)}>
            <FileTextIcon className="size-3.5" /> Browse text
          </Button>
        </div>
        <div className="mt-3 rounded-lg border">
          <div className="px-4 py-3">
            <div className="font-mono text-sm">
              {picked.version ?? "Original"}: {bill.bill_number} — {bill.title}
            </div>
            {bill.description && bill.description !== bill.title && <p className="mt-2 max-w-3xl font-mono text-xs whitespace-pre-wrap text-muted-foreground">{bill.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              {previousOf(picked) ? (
                <>
                  1 parent <span className="font-mono text-primary">{previousOf(picked)!.document_id}</span> ·{" "}
                </>
              ) : (
                "first version · "
              )}
              document <span className="font-mono text-primary">{picked.document_id}</span>
            </span>
            <span className="ml-auto flex items-center gap-3">
              <span className="font-medium text-foreground">
                {versions.length} version{versions.length === 1 ? "" : "s"}
              </span>
              {pickedStats && <DiffBar {...pickedStats} />}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar: Top while scrolled, search within the diffs, unified or split. */}
      <div className="sticky top-0 z-10 mx-auto flex w-full max-w-6xl items-center gap-2 bg-background px-6 py-3">
        {scrolled && (
          <Button variant="ghost" size="sm" onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}>
            <ArrowUpIcon className="size-3.5" /> Top
          </Button>
        )}
        <div className="flex h-8 w-80 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm focus-within:ring-1 focus-within:ring-ring">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search within the text" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Search within the text" />
        </div>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(["unified", "split"] as const).map((v) => (
            <button key={v} type="button" data-active={split === (v === "split")} onClick={() => setSplit(v === "split")} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
              {v === "unified" ? "Unified" : "Split"}
            </button>
          ))}
        </div>
      </div>

      {/* One section per version, newest first. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 pb-6">
        {versions.map((v) => {
          const open = isOpen(v.document_id)
          const prev = previousOf(v)
          const text = texts[v.document_id]
          const before = prev ? texts[prev.document_id] : ""
          const s = statsOf[v.document_id]
          return (
            <section key={v.document_id} data-open={open} className="overflow-hidden rounded-lg border">
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
                  {open ? <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="font-mono">{label(v)}</span>
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
                <div className="h-[70vh] border-t">
                  {text == null || before == null ? (
                    <div className="flex flex-col gap-2 p-4">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
                      ))}
                    </div>
                  ) : (
                    <CodeView text={text} original={prev ? before : null} diff={!!prev && !!before} split={split} wrap={wrap} fold={fold} query={query} onMatches={undefined} />
                  )}
                </div>
              )}
              {!open && s && (
                <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                  {prev ? `Against ${prev.version ?? "the version before"} ${nth(prev)}` : "The first version on file"} · {truncate(bill.title, 80)}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <p className="sr-only">{doc ? `Showing version ${doc}` : ""}</p>
    </div>
  )
}
