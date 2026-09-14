"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { fmtBill, fmtNumber } from "@/lib/format"
import { forkAddress } from "@/lib/policy/forks"
import { useSessionTitle } from "@/lib/policy/scope"
import type { Bill } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { usePaneNoteSetter } from "@/lib/typeset/pane-note"
import type { ExpressionLine } from "@/lib/typeset/expression-document"
import { typesetHref, type TypesetView } from "@/lib/typeset/views"
import { workHref } from "@/lib/xml/library"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { FileRow, ResultsList, resultsTitle, sizeOf, useScopedSearch, type Related, type SearchScope } from "@/components/policy/file-row"
import { PaneAside } from "@/components/policy/pane-aside"
import { VersionsList } from "@/components/policy/versions-aside"
import { cn } from "@govblock/ui/lib/utils"

// The Git view's file row on Typeset's other views (Brendan, 2026-09-14: "the
// same header that the git view has across all views"). The row is
// file-row.tsx; this wires it to whatever the view draws instead of
// CodeMirror. Find in this file searches the page as drawn (Plate, the XML
// reader, the redline, the Library) and marks every match with the CSS
// Custom Highlight API, so no view's DOM is touched and no editor has to
// learn search. The outline is the page's own headings and USLM sections;
// History lists the printings; the size line goes to the footer, as Git's
// does.

type Panel = "outline" | "references" | "results" | "versions" | "related" | null

type Match = { range: Range; line: string }

const HIGHLIGHT = "file-find"
const CURRENT = "file-find-current"
const MAX_MATCHES = 2000

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void }
// Set at run time: the build's CSS parser does not know ::highlight() yet and refuses the stylesheet.
const HIGHLIGHT_STYLE = `::highlight(${HIGHLIGHT}) { background-color: rgb(253 224 71 / 0.45); } ::highlight(${CURRENT}) { background-color: rgb(249 115 22 / 0.55); }`
function useHighlightStyle() {
  React.useEffect(() => {
    if (document.getElementById("file-find-style")) return
    const style = document.createElement("style")
    style.id = "file-find-style"
    style.textContent = HIGHLIGHT_STYLE
    document.head.appendChild(style)
  }, [])
}

const registry = () => (typeof CSS !== "undefined" ? ((CSS as unknown as { highlights?: HighlightRegistry }).highlights ?? null) : null)
const makeHighlight = (ranges: Range[]) => {
  const H = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
  return H ? new H(...ranges) : null
}

/** Runs `read` now, and again 300 ms after the subtree under `root` stops changing; `key` changing runs it afresh. */
function useSettled(root: React.RefObject<HTMLElement | null>, read: () => void, active: boolean, key?: unknown) {
  const latest = React.useRef(read)
  latest.current = read
  React.useEffect(() => {
    const el = root.current
    if (!el || !active) return
    let timer = 0
    latest.current()
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => latest.current(), 300)
    })
    observer.observe(el, { subtree: true, childList: true, characterData: true })
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [root, active, key])
}

/** Every case-insensitive occurrence of `query` in the text drawn under `root`, marked. */
function useFindInView(root: React.RefObject<HTMLElement | null>, query: string) {
  useHighlightStyle()
  const [matches, setMatches] = React.useState<Match[]>([])
  const q = query.trim().toLowerCase()
  useSettled(
    root,
    () => {
      const el = root.current
      if (!el) return
      const found: Match[] = []
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement?.closest("script, style, [aria-hidden='true']") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      })
      for (let node = walker.nextNode(); node && found.length < MAX_MATCHES; node = walker.nextNode()) {
        const value = node.nodeValue ?? ""
        const lower = value.toLowerCase()
        for (let i = lower.indexOf(q); i !== -1 && found.length < MAX_MATCHES; i = lower.indexOf(q, i + q.length)) {
          const range = document.createRange()
          range.setStart(node, i)
          range.setEnd(node, i + q.length)
          found.push({ range, line: value.slice(Math.max(0, i - 40), i + q.length + 60).replace(/\s+/g, " ").trim() })
        }
      }
      setMatches(found)
      const highlight = makeHighlight(found.map((m) => m.range))
      if (highlight) registry()?.set(HIGHLIGHT, highlight)
    },
    !!q,
    q
  )
  React.useEffect(() => {
    if (q) return
    setMatches([])
    registry()?.delete(HIGHLIGHT)
    registry()?.delete(CURRENT)
  }, [q])
  React.useEffect(
    () => () => {
      registry()?.delete(HIGHLIGHT)
      registry()?.delete(CURRENT)
    },
    []
  )
  const goto = React.useCallback((match: Match) => {
    const highlight = makeHighlight([match.range])
    if (highlight) registry()?.set(CURRENT, highlight)
    const target = match.range.startContainer.parentElement
    target?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [])
  return { matches, goto }
}

type Heading = { label: string; depth: number; node: Element }

/** The headings the view draws: HTML headings, and the USLM reader's big and primary levels. */
function useOutlineInView(root: React.RefObject<HTMLElement | null>, active: boolean) {
  const [headings, setHeadings] = React.useState<Heading[]>([])
  useSettled(
    root,
    () => {
      const el = root.current
      if (!el) return
      const out: Heading[] = []
      for (const node of el.querySelectorAll("h1, h2, h3, h4, h5, h6, .uslm-big, .uslm-primary")) {
        if (out.length >= 800) break
        const uslm = node.classList.contains("uslm-big") || node.classList.contains("uslm-primary")
        const label = uslm
          ? [node.querySelector(":scope > .uslm-num")?.textContent, node.querySelector(":scope > .uslm-heading")?.textContent].filter(Boolean).join(" ")
          : (node.textContent ?? "")
        const clean = label.replace(/\s+/g, " ").trim()
        if (!clean) continue
        out.push({ label: clean, depth: uslm ? (node.classList.contains("uslm-big") ? 1 : 2) : Number(node.tagName.slice(1)), node })
      }
      setHeadings(out)
    },
    active
  )
  return headings
}

/** The page's own text, read once it settles, for copy, download and the size line when the view has no plain text of its own. */
function useTextInView(root: React.RefObject<HTMLElement | null>, active: boolean) {
  const [text, setText] = React.useState<string | null>(null)
  useSettled(root, () => setText(root.current?.innerText.trim() || null), active)
  return text
}

export type ChromeFile = {
  /** bill:H.R.6644, or the Work's address. */
  qualifier: string
  state: string
  session: number | null
  rawHref: string
  /** The file's plain text; null reads it off the page. */
  text: string | null
  textReady: boolean
  fileName: string
  related?: Related[]
  history?: React.ReactNode
  onEdit?: () => void
  pageHref?: string
  pageLabel?: string
  /** What History lists. */
  versions: { title: string; body: React.ReactNode } | null
  onOpenResult: (billId: number, documentId?: number) => void
}

export function FileChrome({ file, toolbar, slashFocuses = true, children }: { file: ChromeFile; toolbar?: React.ReactNode; slashFocuses?: boolean; children: React.ReactNode }) {
  const root = React.useRef<HTMLDivElement>(null)
  const [query, setQuery] = React.useState("")
  const [scope, setScope] = React.useState<SearchScope>("bill")
  const [panel, setPanel] = React.useState<Panel>(null)
  const sessionTitle = useSessionTitle(file.state, file.session)
  const { matches, goto } = useFindInView(root, scope === "bill" ? query : "")
  const headings = useOutlineInView(root, true)
  const pageText = useTextInView(root, !file.textReady)
  const text = file.textReady ? file.text : pageText
  const size = React.useMemo(() => sizeOf(text), [text])
  const results = useScopedSearch({ query, scope, state: file.state, session: file.session, onRun: () => setPanel("results") })
  const [cursor, setCursor] = React.useState(-1)
  React.useEffect(() => setCursor(-1), [query])

  const setNote = usePaneNoteSetter()
  React.useEffect(() => {
    if (!setNote) return
    setNote(size ? <span className="font-mono text-xs text-muted-foreground">{size}</span> : null)
    return () => setNote(null)
  }, [setNote, size])

  const qualifiers = { bill: file.qualifier, session: `session:${file.state}/${file.session ?? ""}`, all: "all:govblock" }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
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
        matchCount={matches.length}
        onSubmit={(s) => {
          setPanel(s === "bill" ? "references" : "results")
          // Enter walks the matches, as a find bar does.
          if (s === "bill" && matches.length) {
            const next = (cursor + 1) % matches.length
            setCursor(next)
            goto(matches[next])
          }
        }}
        onClear={() => {
          setQuery("")
          setScope("bill")
          setPanel((p) => (p === "references" || p === "results" ? null : p))
        }}
        related={file.related}
        onSeeAllRelated={() => setPanel("related")}
        size={setNote ? null : size}
        history={file.history}
        rawHref={file.rawHref}
        text={text}
        fileName={file.fileName}
        onEdit={file.onEdit}
        pageHref={file.pageHref}
        pageLabel={file.pageLabel}
        outlineCount={headings.length}
        outlineOpen={panel === "outline"}
        onOutline={() => setPanel((p) => (p === "outline" ? null : "outline"))}
        historyOpen={panel === "versions"}
        onHistory={() => setPanel((p) => (p === "versions" ? null : "versions"))}
        slashFocuses={slashFocuses}
      />
      {toolbar}
      <div className="flex min-h-0 flex-1">
        <div ref={root} className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {panel && (
          <PaneAside
            title={
              panel === "versions"
                ? (file.versions?.title ?? "History")
                : panel === "related"
                  ? `Related · ${file.related?.length ?? 0}`
                  : panel === "outline"
                    ? `Outline · ${headings.length}`
                    : panel === "references"
                      ? `${fmtNumber(matches.length)} references`
                      : resultsTitle(results)
            }
            onClose={() => setPanel(null)}
          >
            {panel === "versions" && (file.versions?.body ?? <p className="px-3 py-4 text-xs text-muted-foreground">No other printings.</p>)}
            {panel === "related" &&
              (file.related?.length ? (
                file.related.map((r, i) => (
                  <button key={`${r.label}-${r.action}-${i}`} type="button" onClick={r.onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted">
                    <span className="truncate font-mono">{r.label}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground">{r.action}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-xs text-muted-foreground">No related bills.</p>
              ))}
            {panel === "outline" &&
              (headings.length ? (
                headings.map((h, i) => (
                  <button key={`${i}-${h.label}`} type="button" onClick={() => h.node.scrollIntoView({ block: "start", behavior: "smooth" })} className="flex w-full items-center px-3 py-1 text-left text-xs hover:bg-muted" style={{ paddingLeft: `${0.75 + Math.max(0, h.depth - 1) * 0.75}rem` }}>
                    <span className="truncate">{h.label}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-xs text-muted-foreground">No sections recognised on this page.</p>
              ))}
            {panel === "references" &&
              (matches.length ? (
                matches.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    data-active={cursor === i}
                    onClick={() => {
                      setCursor(i)
                      goto(m)
                    }}
                    className={cn("flex w-full items-start gap-2 px-3 py-1 text-left text-xs hover:bg-muted data-[active=true]:bg-yellow-300/40")}
                  >
                    <span className="w-8 shrink-0 text-right font-mono text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="truncate">{m.line}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-xs text-muted-foreground">{query.trim() ? "No matches on this page." : "Type to find on this page."}</p>
              ))}
            {panel === "results" && results && <ResultsList results={results} state={file.state} onOpen={file.onOpenResult} />}
          </PaneAside>
        )}
      </div>
    </div>
  )
}

/** A bill's file on its Typeset views: the newest printing's plain text, its printings, its companions. */
export function TypesetBillChrome({ billId, state, session, view, toolbar, children }: { billId: number; state: string; session: number | null; view: TypesetView; toolbar?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter()
  const { data: bill } = usePolicy<Bill>("bill", { state }, { id: billId })
  const versions = React.useMemo<TextVersion[]>(() => [...(bill?.texts ?? [])].sort((a, b) => b.document_id - a.document_id), [bill?.texts])
  const shown = versions[0]
  const { data: doc } = usePolicy<{ text?: string }>(shown ? "text" : null, { state }, { id: billId, document: shown?.document_id })
  const label = bill ? fmtBill(bill.bill_number, bill.state) : "Bill"
  const openGit = (documentId: number) => router.push(typesetHref(billId, "git", { doc: String(documentId) }))
  const openChanges = (documentId: number) => router.push(typesetHref(billId, "diff", { doc: String(documentId) }))

  const file: ChromeFile = {
    qualifier: `bill:${label}`,
    state,
    session,
    rawHref: shown ? `/api/policy/text?state=${state}&id=${billId}&document=${shown.document_id}&format=raw` : "#",
    text: doc?.text ?? null,
    // A bill with no printing on file has nothing to read off the page either.
    textReady: !!bill && (!shown || !!doc),
    fileName: shown ? `${label.toLowerCase().replace(/[^a-z0-9]/g, "")}-${(shown.version ?? "original").replace(/\s+/g, "-").toLowerCase()}.txt` : "",
    related: (bill?.sameAs ?? []).map((s) => ({ label: s.sast_bill_number, action: `View ${s.sast_type?.toLowerCase().includes("same") ? "companion bill" : s.sast_type || "related bill"}`, onClick: () => router.push(typesetHref(s.sast_bill_id, view)) })),
    // The fork is the XML copy (window 5); on the Fork view the pencil has nowhere further to go.
    onEdit: view === "fork" ? undefined : () => router.push(typesetHref(billId, "fork")),
    pageHref: `/bills/${billId}?state=${state}`,
    versions: { title: `Versions · ${versions.length}`, body: <VersionsList versions={versions} current={shown?.document_id ?? null} onChoose={openGit} onOpenChanges={openChanges} /> },
    onOpenResult: (id, documentId) => (id === billId && documentId ? openGit(documentId) : router.push(typesetHref(id, view))),
  }
  return (
    <FileChrome file={file} toolbar={toolbar} slashFocuses={view !== "xml"}>
      {children}
    </FileChrome>
  )
}

/** A Work opened by its address: the Expression's XML as Raw, the page's text for copy and download, its dated history. */
export function TypesetWorkChrome({ work, expression, label, history, toolbar, children }: { work: string; expression: string; label: string; history: ExpressionLine[]; toolbar?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter()
  const jurisdiction = work.split("/")[1] ?? "us"
  const state = jurisdiction === "us" ? "US" : (jurisdiction.split("-")[1] ?? "").toUpperCase()
  const [forking, setForking] = React.useState(false)
  const newest = [...history].reverse()
  const file: ChromeFile = {
    qualifier: `work:${label}`,
    state,
    session: null,
    rawHref: `/api/xml/uslm${work}@${expression}`,
    text: null,
    textReady: false,
    fileName: `${`${work}@${expression}`.replace(/^\//, "").replace(/[^a-z0-9@]+/gi, "-").toLowerCase()}.txt`,
    onEdit: forking
      ? undefined
      : () => {
          setForking(true)
          void forkAddress(`${work}@${expression}`).then((fork) => {
            setForking(false)
            if (fork) router.push(`/workspace/typeset/fork/${fork.id}`)
          })
        },
    versions: newest.length
      ? {
          title: `As it stood · ${newest.length}`,
          body: (
            <div className="py-1">
              {newest.map((line) => (
                <button key={line.expression} type="button" data-active={line.expression === expression} onClick={() => router.push(workHref(`${work}@${line.expression}`))} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted data-[active=true]:bg-muted">
                  {line.unit && <span className="truncate">{line.unit}</span>}
                  <span className="ml-auto shrink-0 font-mono text-muted-foreground tabular-nums">{line.date.slice(0, 10)}</span>
                </button>
              ))}
            </div>
          ),
        }
      : null,
    onOpenResult: (id) => router.push(typesetHref(id)),
  }
  return (
    <FileChrome file={file} toolbar={toolbar} slashFocuses={false}>
      {children}
    </FileChrome>
  )
}
