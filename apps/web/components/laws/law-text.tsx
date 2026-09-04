"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { CheckIcon, CopyIcon, DownloadIcon, SearchIcon, SquareCodeIcon, XIcon } from "lucide-react"

import type { LawHit, LawNode } from "@/app/api/laws/route"
import { fmtNumber } from "@/lib/format"
import { useDocPref } from "@/lib/policy/doc-prefs"
import { useSnapshot } from "@/lib/policy/use-policy"
import type { CodeViewHandle, Match } from "@/components/policy/code-view"
import { Button } from "@govblock/ui/components/nova/button"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { cn } from "@govblock/ui/lib/utils"

// A law, read like a bill: the whole thing, top to bottom, in the same pane
// (Brendan, 2026-09-04: "make the whole thing readable like an essay… give
// me the consolidated laws in one bill view, all the way down"). The nodes
// come in order from /api/laws?text=1, a page at a time under the Data API's
// cap, and are joined into one document; every article and section is an
// outline entry, so the reader jumps rather than clicks down three levels.
// Search is this law (matches in the document) or every law (the index).

const CodeView = dynamic(() => import("@/components/policy/code-view").then((m) => m.CodeView), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-64 rounded-xl" />,
})

type Page = { nodes: (LawNode & { text: string | null })[]; next: number | null }
type Entry = { line: number; label: string; location_id: string; doc_type: string }

const unescape = (t: string | null | undefined) => (t ? t.replace(/\\n/g, "\n") : "")

const label = (n: { doc_type: string; doc_level_id?: string | null; title?: string | null; location_id: string }) => {
  const kind = n.doc_type.charAt(0) + n.doc_type.slice(1).toLowerCase().replace("_", " ")
  const id = n.doc_type === "SECTION" ? `§ ${n.doc_level_id ?? n.location_id}` : `${kind} ${n.doc_level_id ?? n.location_id}`
  return n.title ? `${id} — ${n.title}` : id
}

/** The law's text, assembled page by page; `entries` map its parts to lines. */
function useLawText(law: string) {
  const EMPTY = React.useMemo(() => ({ law, text: "", entries: [] as Entry[], done: false, nodes: 0 }), [law])
  const [loaded, setState] = React.useState<{ law: string; text: string; entries: Entry[]; done: boolean; nodes: number }>(EMPTY)
  // Another law's text is not this law's: until this one's first page lands, it is empty.
  const state = loaded.law === law ? loaded : EMPTY
  React.useEffect(() => {
    let live = true
    let after = -1
    let text = ""
    let line = 0
    const entries: Entry[] = []
    let nodes = 0
    const step = async () => {
      while (live) {
        const r = await fetch(`/api/laws?law=${law}&text=1&after=${after}`)
        if (!r.ok) break
        const page = (await r.json()) as Page
        for (const n of page.nodes) {
          const body = unescape(n.text).replace(/\s+$/, "")
          if (n.title || n.doc_type === "SECTION") entries.push({ line, label: label(n), location_id: n.location_id, doc_type: n.doc_type })
          const chunk = (body ? body : label(n)) + "\n\n"
          text += chunk
          line += chunk.split("\n").length - 1
          nodes++
        }
        if (!live) return
        setState({ law, text, entries: [...entries], done: page.next === null, nodes })
        if (page.next === null) break
        after = page.next
      }
    }
    void step()
    return () => {
      live = false
    }
  }, [law])
  return state
}

export function LawText({ law, lawName, doc, onDoc, allowAll = true }: { law: string; lawName: string; /** A section to scroll to. */ doc: string | null; onDoc: (locationId: string | null) => void; allowAll?: boolean }) {
  const { text, entries, done, nodes } = useLawText(law)
  const [wrap] = useDocPref("wrap", true)
  const [fold] = useDocPref("fold", true)
  const [query, setQuery] = React.useState("")
  const [scope, setScope] = React.useState<"law" | "all">("law")
  const [panel, setPanel] = React.useState<"outline" | "references" | "results" | null>("outline")
  const [matches, setMatches] = React.useState<Match[]>([])
  const [target, setTarget] = React.useState<number | null>(null)
  const [hover, setHover] = React.useState<number | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [outlineFilter, setOutlineFilter] = React.useState("")
  const code = React.useRef<CodeViewHandle>(null)
  const { data: results } = useSnapshot<{ hits: LawHit[] }>(scope === "all" && query.trim().length >= 2 ? `/api/laws?q=${encodeURIComponent(query.trim())}` : null)

  const onMatches = React.useCallback((found: Match[]) => setMatches(found), [])
  const goto = React.useCallback((line: number) => {
    setTarget(line)
    code.current?.goto(line)
  }, [])

  // A section named in the URL: scroll to it once its text has arrived.
  const wanted = React.useRef<string | null>(null)
  React.useEffect(() => {
    wanted.current = doc
  }, [doc])
  React.useEffect(() => {
    if (!wanted.current) return
    const e = entries.find((x) => x.location_id === wanted.current)
    if (e) {
      wanted.current = null
      window.setTimeout(() => goto(e.line), 50)
    }
  }, [entries, goto])

  const size = React.useMemo(() => {
    if (!text) return null
    const lines = text.split("\n")
    const kb = new Blob([text]).size / 1024
    return `${fmtNumber(lines.length)} lines · ${kb >= 1000 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`}${done ? "" : " · loading…"}`
  }, [text, done])

  const shownEntries = outlineFilter.trim() ? entries.filter((e) => e.label.toLowerCase().includes(outlineFilter.toLowerCase())) : entries
  const references = matches

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Finding: this law, or every law. */}
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <div className="relative min-w-64 flex-1">
          <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background pr-8 pl-2.5 text-sm focus-within:ring-1 focus-within:ring-ring">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <button type="button" onClick={() => allowAll && setScope((s) => (s === "law" ? "all" : "law"))} className="shrink-0 rounded bg-primary/10 px-1 font-mono text-xs text-primary" title="Click to switch the scope">
              {scope === "law" ? `law:${law}` : "all:laws"}
            </button>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPanel(scope === "law" ? "references" : "results")
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("")
              }}
              placeholder={scope === "law" ? `Find in the ${lawName} Law…` : "Search every law of New York…"}
              className="min-w-0 flex-1 bg-transparent outline-none"
              aria-label="Search"
            />
          </div>
          <button
            type="button"
            aria-label="Clear the search"
            onClick={() => {
              setQuery("")
              setPanel("outline")
            }}
            className={cn("absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground", !query && "opacity-50")}
          >
            <XIcon className="size-3.5" />
          </button>
          {query.trim() && scope === "law" && <span className="absolute top-1/2 right-8 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">{fmtNumber(references.length)}</span>}
        </div>
      </div>

      {/* The file toolbar, GitHub's order. */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
        {size && <span className="font-mono text-xs text-muted-foreground">{size}</span>}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-md border" role="group">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-none"
              aria-label="Copy the text"
              disabled={!text}
              onClick={() => {
                void navigator.clipboard?.writeText(text)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-none border-l"
              aria-label="Download the text"
              disabled={!text}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
                const a = document.createElement("a")
                a.href = url
                a.download = `ny-${law.toLowerCase()}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <DownloadIcon />
            </Button>
          </div>
          <Button variant="outline" size="icon-sm" aria-label={`Outline · ${entries.length}`} title={`Outline · ${entries.length}`} onClick={() => setPanel((p) => (p === "outline" ? null : "outline"))} data-active={panel === "outline"} className="data-[active=true]:bg-muted">
            <SquareCodeIcon />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {!text ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
          ) : (
            <CodeView ref={code} text={text} wrap={wrap} fold={fold} query={scope === "law" ? query : ""} highlight={hover ?? target} onMatches={onMatches} />
          )}
        </div>
        {panel && (
          <aside className="flex w-80 shrink-0 flex-col border-l">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs font-medium">
              {panel === "outline" ? `Outline · ${fmtNumber(entries.length)}${done ? "" : ` of ~${fmtNumber(nodes)}…`}` : panel === "references" ? `${fmtNumber(references.length)} references` : results ? `Results · every law` : "Searching…"}
              <button type="button" aria-label="Close" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setPanel(null)}>
                <XIcon className="size-3.5" />
              </button>
            </div>
            {panel === "outline" && (
              <div className="shrink-0 border-b px-2 py-1.5">
                <input value={outlineFilter} onChange={(e) => setOutlineFilter(e.target.value)} placeholder="Filter sections…" className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring" aria-label="Filter the outline" />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {panel === "outline" &&
                shownEntries.map((e) => (
                  <button
                    key={e.location_id}
                    type="button"
                    data-active={target === e.line}
                    onMouseEnter={() => setHover(e.line)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      goto(e.line)
                      onDoc(e.location_id)
                    }}
                    className={cn("flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-muted data-[active=true]:bg-yellow-300/40", e.doc_type !== "SECTION" && "font-medium")}
                  >
                    <span className="w-12 shrink-0 text-right font-mono text-muted-foreground tabular-nums">{e.line + 1}</span>
                    <span className={cn("truncate", e.doc_type !== "SECTION" ? "" : "pl-3")}>{e.label}</span>
                  </button>
                ))}
              {panel === "references" &&
                (references.length ? (
                  references.map((m, i) => (
                    <button key={`${m.line}-${i}`} type="button" data-active={target === m.line} onMouseEnter={() => setHover(m.line)} onMouseLeave={() => setHover(null)} onClick={() => goto(m.line)} className="flex w-full items-start gap-2 px-3 py-1 text-left text-xs hover:bg-muted data-[active=true]:bg-yellow-300/40">
                      <span className="w-12 shrink-0 text-right font-mono text-muted-foreground tabular-nums">{m.line + 1}</span>
                      <span className="truncate font-mono">{m.text.trim()}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-4 text-xs text-muted-foreground">{query.trim() ? "No matches in this law." : "Type to find in this law."}</p>
                ))}
              {panel === "results" &&
                (results?.hits ?? []).map((h) => (
                  <a key={`${h.law_id}-${h.location_id}`} href={`/laws?law=${h.law_id}&doc=${encodeURIComponent(h.location_id)}`} className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-primary">{label(h)}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">{h.law_name}</span>
                    </span>
                    <span className="line-clamp-2 text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground" dangerouslySetInnerHTML={{ __html: unescape(h.snippet).replace(/<(?!\/?b>)/g, "&lt;") }} />
                  </a>
                ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
