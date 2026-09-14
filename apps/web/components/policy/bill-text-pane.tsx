"use client"

import { fmtBill } from "@/lib/format"
import * as React from "react"
import dynamic from "next/dynamic"

import { fmtNumber } from "@/lib/format"
import { type BillLayout } from "@/lib/policy/bill-text-layout"
import { FILE_ACTION, useDocPref, type FileAction } from "@/lib/policy/doc-prefs"
import { usePolicy } from "@/lib/policy/use-policy"
import type { CodeViewHandle, Match } from "@/components/policy/code-view"
import { FileRow, ResultsList, downloadText, resultsTitle, sizeOf, useScopedSearch, type Related, type SearchScope } from "@/components/policy/file-row"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { PaneAside } from "@/components/policy/pane-aside"
import { VersionsList } from "@/components/policy/versions-aside"
import { usePaneNoteSetter } from "@/lib/typeset/pane-note"

// A bill's text as a file: the file view GitHub gives a source file, put to a
// bill. One view for every jurisdiction — CodeMirror, line numbers, left
// aligned (Brendan, 2026-09-03 evening: "We no longer need Read and Code,
// just give me one uniform view across all jurisdictions, no more centering")
// — with an outline of sections, references in this file, and search in
// three scopes: this bill, this session, all of govblock. Diffs live in the
// Changes view, not here.
//
// Two rows above the text. The first is finding and where else to go: the
// search box at the left, the History button at the right — History is the
// versions as a commit list. The second is GitHub's file toolbar in GitHub's
// order: the file's size (lines, loc, KB) at the left; at the right Raw, copy
// and download as one group, the pencil with its menu, and the outline
// toggle. The file's name is the breadcrumb's, so nothing here repeats it;
// the more-actions menu is in the block's header and talks to this pane
// through `doc-prefs`.
//
// The row itself is file-row.tsx (2026-09-14), so Typeset's other views wear
// it too; this pane wires it to CodeMirror.
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

export type TextVersion = { document_id: number; version: string | null; chars: number; fetched_at: string | null; /** The document's own date, where the source gave one. */ date?: string | null; /** Set when the version is a commit in a fork. */ commit?: { id: number; message: string; description: string; author: string; text: string; fork_id?: number; owner?: string | null; parent_document_id?: number | null; parent_commit_id?: number | null } }

export type PaneBill = { bill_id: number; bill_number: string; title: string; status_desc?: string | null; last_action_date?: string | null; committee?: string | null }

export type { Related } from "@/components/policy/file-row"

type Panel = "outline" | "references" | "results" | "versions" | "related" | null

export function BillTextPane({
  state,
  session,
  sessionTitle,
  bill,
  versions,
  current,
  onChoose,
  onOpenBill,
  history,
  related,
  onEdit,
  onOpenChanges,
  toolbar,
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
  /** The fork chip, beside the file buttons. */
  history?: React.ReactNode
  /** What the search panel offers beside the scopes. */
  related?: Related[]
  /** The pencil: edit this bill. Absent, the pencil is disabled. */
  onEdit?: () => void
  /** What a version changed, from the versions aside. */
  onOpenChanges?: (documentId: number) => void
  /** Drawn under the file row and over the text (Brendan, 2026-09-14): Typeset's rich-text toolbar. */
  toolbar?: React.ReactNode
}) {
  const [wrap] = useDocPref("wrap", true)
  const [fold] = useDocPref("fold", true)
  const [center] = useDocPref("center", false)
  const [query, setQuery] = React.useState("")
  const [scope, setScope] = React.useState<SearchScope>("bill")
  const [panel, setPanel] = React.useState<Panel>(null)
  const [matches, setMatches] = React.useState<Match[]>([])
  const [layout, setLayout] = React.useState<BillLayout | null>(null)
  // The outline's hover lights the line it points at; a click keeps it lit.
  const [target, setTarget] = React.useState<number | null>(null)
  const [hover, setHover] = React.useState<number | null>(null)
  const highlight = hover ?? target
  const code = React.useRef<CodeViewHandle>(null)

  const shown = versions.find((v) => v.document_id === current) ?? versions[0]

  const { data: doc } = usePolicy<{ text?: string }>(shown && !shown.commit ? "text" : null, { state }, { id: bill.bill_id, document: shown?.document_id })
  const text = shown?.commit?.text ?? doc?.text ?? null
  const rawHref = shown && !shown.commit ? `/api/policy/text?state=${state}&id=${bill.bill_id}&document=${shown.document_id}&format=raw` : "#"

  const size = React.useMemo(() => sizeOf(text), [text])
  // In Typeset the size line goes to the workspace footer (Brendan, 2026-09-13).
  const setNote = usePaneNoteSetter()
  React.useEffect(() => {
    if (!setNote) return
    setNote(size ? <span className="font-mono text-xs text-muted-foreground">{size}</span> : null)
    return () => setNote(null)
  }, [setNote, size])

  const outline = layout?.headings ?? []

  const results = useScopedSearch({ query, scope, state, session, onRun: () => setPanel("results") })

  const onMatches = React.useCallback((found: Match[]) => setMatches(found), [])
  const onLayout = React.useCallback((l: BillLayout) => setLayout(l), [])
  const references = matches

  const goto = (line: number) => {
    setTarget(line)
    code.current?.goto(line)
  }

  // The header's more-actions menu asks; this pane, which has the text and
  // the editor, answers.
  const fileName = shown ? `${fmtBill(bill.bill_number, state).toLowerCase().replace(/[^a-z0-9]/g, "")}-${(shown.version ?? "original").replace(/\s+/g, "-").toLowerCase()}.txt` : ""
  React.useEffect(() => {
    const on = (e: Event) => {
      const action = (e as CustomEvent<FileAction>).detail
      if (action === "download" && text) downloadText(fileName, text)
      if (action === "jump") {
        const answer = window.prompt("Jump to line")
        const line = Number(answer)
        if (Number.isFinite(line) && line > 0) goto(line - 1)
      }
    }
    window.addEventListener(FILE_ACTION, on)
    return () => window.removeEventListener(FILE_ACTION, on)
  }, [text, fileName])

  const openResult = (billId: number, documentId?: number) => {
    if (billId === bill.bill_id && documentId && versions.some((v) => v.document_id === documentId)) onChoose(documentId)
    else if (onOpenBill) onOpenBill(billId, documentId)
    else window.open(`/bills/${billId}?state=${state}`, "_blank", "noopener")
  }

  const qualifiers = { bill: `bill:${fmtBill(bill.bill_number, state)}`, session: `session:${state}/${session ?? ""}`, all: "all:govblock" }

  if (!shown) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No text on file for {fmtBill(bill.bill_number, state)} yet.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileRow
        qualifiers={qualifiers}
        sessionTitle={sessionTitle}
        query={query}
        onQuery={(value) => {
          setQuery(value)
          if (scope === "bill" && value.trim()) setPanel("references")
        }}
        scope={scope}
        onScope={setScope}
        matchCount={references.length}
        onSubmit={(s) => setPanel(s === "bill" ? "references" : "results")}
        onClear={() => {
          setQuery("")
          setScope("bill")
          setPanel((p) => (p === "references" || p === "results" ? null : p))
        }}
        related={related}
        onSeeAllRelated={() => setPanel("related")}
        size={setNote ? null : size}
        history={history}
        rawHref={rawHref}
        text={text}
        fileName={fileName}
        onEdit={onEdit}
        pageHref={`/bills/${bill.bill_id}?state=${state}`}
        outlineCount={outline.length}
        outlineOpen={panel === "outline"}
        onOutline={() => setPanel((p) => (p === "outline" ? null : "outline"))}
        historyOpen={panel === "versions"}
        onHistory={() => setPanel((p) => (p === "versions" ? null : "versions"))}
      />
      {toolbar}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {text === null ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
          ) : (
            <CodeView ref={code} text={text} wrap={wrap} fold={fold} center={center} query={scope === "bill" ? query : ""} highlight={highlight} onMatches={onMatches} onLayout={onLayout} />
          )}
        </div>

        {panel && (
          <PaneAside title={panel === "versions" ? `Versions · ${versions.length}` : panel === "related" ? `Related · ${related?.length ?? 0}` : panel === "outline" ? `Outline · ${outline.length}` : panel === "references" ? `${fmtNumber(references.length)} references` : resultsTitle(results)} onClose={() => setPanel(null)}>
              {panel === "versions" && <VersionsList versions={versions} current={current ?? shown?.document_id ?? null} onChoose={onChoose} onOpenChanges={onOpenChanges} />}
              {panel === "related" &&
                (related?.length ? (
                  related.map((r, i) => (
                    <button key={`${r.label}-${r.action}-${i}`} type="button" onClick={r.onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted">
                      <span className="truncate font-mono">{r.label}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">{r.action}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-4 text-xs text-muted-foreground">No related bills.</p>
                ))}
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
              {panel === "results" && results && <ResultsList results={results} state={state} onOpen={openResult} />}
          </PaneAside>
        )}
      </div>
    </div>
  )
}
