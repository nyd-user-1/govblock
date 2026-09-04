"use client"

import * as React from "react"
import { BookOpenIcon, ChevronRightIcon, CopyIcon, CheckIcon, FileTextIcon, FolderIcon, SearchIcon, XIcon } from "lucide-react"

import type { LawDoc, LawHit, LawNode, LawSummary } from "@/app/api/laws/route"
import { fmtNumber } from "@/lib/format"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { useSnapshot } from "@/lib/policy/use-policy"
import { BlockShell } from "@/components/policy/block-shell"
import { Button } from "@govblock/ui/components/nova/button"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// The Laws of New York as a repository, the way /create shows a legislature:
// the laws in the rail, a law's articles and sections as folders and files
// on the stage, a section's text as the file, and one search box over all of
// it — this law, or every law. The URL is the location: `?law=GBS&doc=1420`.
//
// Text is set as the Open Legislation API gives it, whitespace kept, in a
// readable measure — the law is prose, not a source file.

const TYPE_LABEL: Record<string, string> = { CONSOLIDATED: "Consolidated laws", MISC: "Constitution", UNCONSOLIDATED: "Unconsolidated laws", COURT_ACTS: "Court acts", RULES: "Rules" }

/** The API writes line breaks as a literal backslash-n; the table is fixed on load, and this guards a fresh row. */
const unescape = (t: string | null | undefined) => (t ? t.replace(/\\n/g, "\n") : "")

const label = (n: { doc_type: string; doc_level_id?: string | null; title?: string | null; location_id: string }) => {
  const kind = n.doc_type.charAt(0) + n.doc_type.slice(1).toLowerCase().replace("_", " ")
  const id = n.doc_type === "SECTION" ? `§ ${n.doc_level_id ?? n.location_id}` : `${kind} ${n.doc_level_id ?? n.location_id}`
  return n.title ? `${id} — ${n.title}` : id
}

export function LawsBrowser() {
  const params = useUrlParams(["law", "doc", "q"] as const)
  const law = params.law || null
  const doc = params.doc || null
  const [query, setQuery] = React.useState(params.q ?? "")
  const [scope, setScope] = React.useState<"law" | "all">(law ? "law" : "all")
  const [filter, setFilter] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  const { data: list } = useSnapshot<{ laws: LawSummary[] }>("/api/laws?list=1")
  const { data: tree } = useSnapshot<{ law_id: string; law_name: string; law_type: string; nodes: LawNode[] }>(law ? `/api/laws?law=${law}` : null)
  const { data: node } = useSnapshot<LawDoc>(law && doc ? `/api/laws?law=${law}&doc=${encodeURIComponent(doc)}` : null)
  const searching = params.q?.trim() ? `/api/laws?q=${encodeURIComponent(params.q.trim())}${scope === "law" && law ? `&law=${law}` : ""}` : null
  const { data: results } = useSnapshot<{ hits: LawHit[] }>(searching)

  const go = (next: { law?: string | null; doc?: string | null; q?: string | null }) => writeUrlParams({ law: next.law === undefined ? law : next.law, doc: next.doc === undefined ? doc : next.doc, q: next.q === undefined ? params.q || null : next.q }, { history: "push" })

  const current = list?.laws.find((l) => l.law_id === law)
  const rootId = tree?.nodes[0]?.location_id ?? null
  // The children of what is chosen: the law's top level, or a node's.
  const children: LawNode[] = React.useMemo(() => {
    if (!tree) return []
    const parent = doc ?? rootId
    return tree.nodes.filter((n) => n.parent_location_id === parent)
  }, [tree, doc, rootId])
  const shown = doc && node ? node : null
  const isFile = !!shown && shown.doc_type === "SECTION"

  const crumbs = (
    <div className="flex min-w-0 items-center gap-1 text-sm font-normal">
      <button type="button" onClick={() => go({ law: null, doc: null, q: null })} className="shrink-0 text-primary hover:underline">
        New York
      </button>
      {current && (
        <>
          <span className="text-muted-foreground">/</span>
          <button type="button" onClick={() => go({ doc: null })} className={cn("shrink-0 hover:underline", doc ? "text-primary" : "font-medium")}>
            {current.law_name}
          </button>
        </>
      )}
      {shown?.crumbs.filter((c) => c.location_id !== rootId).map((c) => (
        <React.Fragment key={c.location_id}>
          <span className="text-muted-foreground">/</span>
          <button type="button" onClick={() => go({ doc: c.location_id })} className="shrink-0 text-primary hover:underline">
            …
          </button>
        </React.Fragment>
      ))}
      {shown && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="truncate font-medium">{label(shown)}</span>
        </>
      )}
      {!isFile && <span className="text-muted-foreground">/</span>}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy the link"
        className="ml-1 shrink-0"
        onClick={() => {
          void navigator.clipboard?.writeText(window.location.href)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )

  const rail = (
    <>
      <SidebarHeader className="p-2">
        <div className="relative">
          <SidebarInput placeholder="Go to law…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Go to law" className="pr-7" />
          {filter ? (
            <button type="button" aria-label="Clear" onClick={() => setFilter("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          ) : (
            <SearchIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {list ? (
          Object.entries(TYPE_LABEL).map(([type, name]) => {
            const laws = list.laws.filter((l) => l.law_type === type && (!filter || `${l.law_name} ${l.law_id}`.toLowerCase().includes(filter.toLowerCase())))
            if (!laws.length) return null
            return (
              <SidebarGroup key={type}>
                <SidebarGroupLabel>{name}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {laws.map((l) => (
                      <SidebarMenuItem key={l.law_id}>
                        <SidebarMenuButton isActive={l.law_id === law} onClick={() => go({ law: l.law_id, doc: null })} title={`${l.law_name} · ${fmtNumber(l.sections)} sections`} className="gap-1.5">
                          <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{l.law_name}</span>
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{l.law_id}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          })
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-4 rounded" />
            ))}
          </div>
        )}
      </SidebarContent>
    </>
  )

  const qualifier = scope === "law" && current ? `law:${current.law_id}` : "all:laws"

  return (
    <BlockShell rail={rail} title={crumbs} contentClassName="overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Finding: this law, or every law. */}
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <div className="relative min-w-64 flex-1">
            <div className="flex h-8 items-center gap-1.5 rounded-md border bg-background pr-8 pl-2.5 text-sm focus-within:ring-1 focus-within:ring-ring">
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <button type="button" onClick={() => setScope((s) => (s === "law" && current ? "all" : current ? "law" : "all"))} className="shrink-0 rounded bg-primary/10 px-1 font-mono text-xs text-primary" title="Click to switch the scope">
                {qualifier}
              </button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") go({ q: query.trim() || null })
                  if (e.key === "Escape") {
                    setQuery("")
                    go({ q: null })
                  }
                }}
                placeholder={scope === "law" && current ? `Search the ${current.law_name} Law…` : "Search every law of New York…"}
                className="min-w-0 flex-1 bg-transparent outline-none"
                aria-label="Search the laws"
              />
            </div>
            <button
              type="button"
              aria-label="Clear the search"
              onClick={() => {
                setQuery("")
                go({ q: null })
              }}
              className={cn("absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground", !query && "opacity-50")}
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          {shown && (
            <a href={`https://www.nysenate.gov/legislation/laws/${shown.law_id}/${shown.location_id}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-muted-foreground hover:underline">
              nysenate.gov
            </a>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {params.q?.trim() ? (
            // Results, GitHub's code-search way: the section, then the lines that matched.
            <div className="mx-auto w-full max-w-4xl px-6 py-4">
              <p className="mb-3 text-sm text-muted-foreground">
                {results ? `${results.hits.length}${results.hits.length === 50 ? "+" : ""} sections match “${params.q}”${scope === "law" && current ? ` in the ${current.law_name} Law` : ""}` : "Searching…"}
              </p>
              <div className="flex flex-col gap-2">
                {results?.hits.map((h) => (
                  <button key={`${h.law_id}-${h.location_id}`} type="button" onClick={() => go({ law: h.law_id, doc: h.location_id, q: null })} className="rounded-lg border px-4 py-3 text-left hover:bg-muted/40">
                    <div className="flex items-center gap-2 text-sm">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-primary">{label(h)}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{h.law_name}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground" dangerouslySetInnerHTML={{ __html: unescape(h.snippet).replace(/<(?!\/?b>)/g, "&lt;") }} />
                  </button>
                ))}
                {results && !results.hits.length && <p className="py-8 text-center text-sm text-muted-foreground">Nothing in the law matches “{params.q}”.</p>}
              </div>
            </div>
          ) : !law ? (
            // The organisation page: every law, as a table.
            <div className="m-4 overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Law</TableHead>
                    <TableHead className="w-40">Kind</TableHead>
                    <TableHead className="w-24">Chapter</TableHead>
                    <TableHead className="w-28 text-right">Sections</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list?.laws.map((l) => (
                    <TableRow key={l.law_id} className="group/row cursor-pointer" onClick={() => go({ law: l.law_id, doc: null })}>
                      <TableCell>
                        <span className="flex items-center gap-2.5 font-medium">
                          <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="group-hover/row:text-primary group-hover/row:underline">{l.law_name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{l.law_id}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{TYPE_LABEL[l.law_type] ?? l.law_type}</TableCell>
                      <TableCell className="text-muted-foreground">{l.chapter ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{fmtNumber(l.sections)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : isFile && shown ? (
            // A section: the law's own text, in a readable measure.
            <article className="mx-auto w-full max-w-4xl px-6 py-6">
              <h1 className="text-xl font-semibold">{label(shown)}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {shown.law_name} Law{shown.crumbs.filter((c) => c.location_id !== rootId).map((c) => ` · ${label(c)}`)}
                {shown.active_date ? ` · effective ${shown.active_date}` : ""}
                {shown.repealed ? " · repealed" : ""}
              </p>
              <pre className="mt-6 font-sans text-[15px] leading-7 whitespace-pre-wrap text-foreground">{unescape(shown.text)}</pre>
            </article>
          ) : (
            // A law, or an article: its parts as a table, like a folder.
            <div className="m-4 overflow-hidden rounded-lg border">
              {shown?.text && shown.doc_type !== "SECTION" && shown.text.trim() && <pre className="border-b px-4 py-3 font-sans text-sm leading-6 whitespace-pre-wrap text-muted-foreground">{unescape(shown.text).trim()}</pre>}
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">Kind</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc && (
                    <TableRow className="group/row cursor-pointer" onClick={() => go({ doc: shown?.parent_location_id && shown.parent_location_id !== rootId ? shown.parent_location_id : null })}>
                      <TableCell colSpan={2} className="text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <FolderIcon className="size-4" /> <span className="group-hover/row:text-primary group-hover/row:underline">..</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  {(tree ? children : []).map((n) => (
                    <TableRow key={n.location_id} className="group/row cursor-pointer" onClick={() => go({ doc: n.location_id })}>
                      <TableCell className="max-w-0">
                        <span className="flex items-center gap-2.5 font-medium">
                          {n.doc_type === "SECTION" ? <FileTextIcon className="size-4 shrink-0 text-muted-foreground" /> : <FolderIcon className="size-4 shrink-0 text-muted-foreground" />}
                          <span className={cn("truncate group-hover/row:text-primary group-hover/row:underline", n.repealed && "line-through opacity-60")}>{label(n)}</span>
                          {n.doc_type !== "SECTION" && <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{n.doc_type.charAt(0) + n.doc_type.slice(1).toLowerCase().replace("_", " ")}</TableCell>
                    </TableRow>
                  ))}
                  {!tree && (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Skeleton className="h-4 w-1/2 rounded" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </BlockShell>
  )
}
