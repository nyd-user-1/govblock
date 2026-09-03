"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, FolderIcon, FolderOpenIcon, SearchIcon, XIcon } from "lucide-react"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { layoutBillText, printChangeMarks, type BillLayout } from "@/lib/policy/bill-text-layout"
import { billInScope, useScope, useSessionTitle } from "@/lib/policy/scope"
import { useLocal } from "@/lib/policy/use-local"
import { useUrlParams } from "@/lib/policy/url-state"
import { usePolicy, useSnapshot } from "@/lib/policy/use-policy"
import { BillText } from "@/components/bill-text"
import { BlockShell } from "@/components/policy/block-shell"
import type { CodeViewHandle, Match } from "@/components/policy/code-view"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@govblock/ui/components/nova/breadcrumb"
import { Button } from "@govblock/ui/components/nova/button"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// The file-tree block, put to work: Documents — and since 2026-09-03 the
// repository view of the record. Brendan, looking at GitHub: folders are
// committees, files are bills, a bill's versions are its history, an amended
// text against the one before it is a diff, and search has scopes — this
// bill, this session, all of govblock.
//
// Rail:    a "Go to file" filter · Changes (the newest versions in scope) ·
//          one folder per committee › the bills before it › each bill's
//          versions, newest first · Forms, under the department the rail chose
// Pane:    Read (the standard bill text) or Code (CodeMirror: the legislature's
//          own line numbers, sections that fold, find, a diff against the
//          previous version), with a history strip of the versions, the
//          search box with its three scopes, and a panel for the outline, the
//          references in this file, or the results from elsewhere.
//
// The rail's scope narrows the tree: a chamber, a committee or a status leaves
// only the bills that carry it.

const CodeView = dynamic(() => import("@/components/policy/code-view").then((m) => m.CodeView), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-64 rounded-xl" />,
})

type TextRow = {
  document_id: number
  version: string | null
  chars: number
  fetched_at: string | null
  bill_id: number
  bill_number: string
  title: string
  body: string | null
  status_desc: string | null
  last_action_date: string | null
  committee?: string | null
}

type FormRow = { id: number; gov: string; agency: string; number: string; title: string | null; file: string; pages: number | null; fields: number }
type FormsAnswer = { count: number; rows: FormRow[]; empty?: string }

type SearchAnswer = {
  bills: { bill_id: number; bill_number: string; title: string; status_desc: string | null; last_action_date: string | null; state: string }[]
  texts: { bill_id: number; document_id: number; state: string; bill_number: string; title: string; snippet: string }[]
}

type Selected = { kind: "text"; id: number } | { kind: "form"; id: number } | null
type Scope = "bill" | "session" | "all"
type Panel = "outline" | "references" | "results" | null

const NOT_AGENCIES = new Set(["legislature", "executive", "fec"])
const NO_COMMITTEE = "Not yet referred"

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

export function DocumentsTree() {
  const { state, session, filters, resolved } = useScope()
  const sessionTitle = useSessionTitle(state, session)
  // A link can open the pane in Code and with the diff on (`?text=code&diff=1`).
  const url = useUrlParams(["text", "diff", "split"] as const)
  const { data: texts, isLoading } = usePolicy<TextRow[]>("texts", { state, session: filters.session }, { limit: 160 })

  const [selected, setSelected] = React.useState<Selected>(null)
  const [openFolders, setOpenFolders] = React.useState<Set<string>>(() => new Set())
  const [openBills, setOpenBills] = React.useState<Set<number>>(() => new Set())
  const [filter, setFilter] = React.useState("")
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
  const code = React.useRef<CodeViewHandle>(null)

  // ── The tree ─────────────────────────────────────────────────────────────

  const inScope = React.useMemo(() => (texts ?? []).filter((row) => billInScope(row, filters)), [texts, filters])
  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return inScope
    return inScope.filter((row) => row.bill_number.toLowerCase().includes(q) || row.title.toLowerCase().includes(q) || (row.committee ?? "").toLowerCase().includes(q))
  }, [inScope, filter])

  // committee › bill › versions (newest first)
  const folders = React.useMemo(() => {
    const byCommittee = new Map<string, Map<number, TextRow[]>>()
    for (const row of filtered) {
      const folder = row.committee || NO_COMMITTEE
      const bills = byCommittee.get(folder) ?? new Map<number, TextRow[]>()
      const versions = bills.get(row.bill_id) ?? []
      versions.push(row)
      bills.set(row.bill_id, versions)
      byCommittee.set(folder, bills)
    }
    return [...byCommittee.entries()]
      .map(([name, bills]) => ({
        name,
        bills: [...bills.entries()].map(([bill_id, versions]) => ({ bill_id, head: versions[0], versions: [...versions].sort((a, b) => b.document_id - a.document_id) })).sort((a, b) => a.head.bill_number.localeCompare(b.head.bill_number, undefined, { numeric: true })),
      }))
      .sort((a, b) => (a.name === NO_COMMITTEE ? 1 : b.name === NO_COMMITTEE ? -1 : a.name.localeCompare(b.name)))
  }, [filtered])

  const current = selected?.kind === "text" ? inScope.find((row) => row.document_id === selected.id) : selected ? undefined : inScope[0]
  const versions = React.useMemo(() => (current ? inScope.filter((r) => r.bill_id === current.bill_id).sort((a, b) => b.document_id - a.document_id) : []), [inScope, current])
  const previous = current ? versions[versions.findIndex((v) => v.document_id === current.document_id) + 1] : undefined

  // The filter opens the folders it matched; a click opens or closes one.
  const folderOpen = (name: string) => openFolders.has(name) || (!!filter.trim() && folders.length <= 8)
  const toggleFolder = (name: string) =>
    setOpenFolders((set) => {
      const next = new Set(set)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  const toggleBill = (id: number) =>
    setOpenBills((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const choose = (row: TextRow) => {
    setSelected({ kind: "text", id: row.document_id })
    setDiff(diffPicked === null ? null : false)
    setOpenBills((set) => new Set(set).add(row.bill_id))
    setOpenFolders((set) => new Set(set).add(row.committee || NO_COMMITTEE))
  }

  // ── Forms, under the department ───────────────────────────────────────────

  const agency = filters.department && !NOT_AGENCIES.has(filters.department) ? filters.department : ""
  const formsQuery = new URLSearchParams({ state, limit: "40" })
  if (agency) formsQuery.set("agency", agency)
  if (filters.forms === "all") formsQuery.set("all", "1")
  if (filters.forms === "fillable") formsQuery.set("fillable", "1")
  const { data: forms } = useSnapshot<FormsAnswer>(resolved && filters.department !== "legislature" && filters.department !== "fec" ? `/api/policy/forms?${formsQuery}` : null)
  const currentForm = selected?.kind === "form" ? (forms?.rows ?? []).find((row) => row.id === selected.id) : undefined
  const { data: formDetail } = useSnapshot<{ pdf?: string | null; pdfError?: string | null }>(currentForm ? `/api/policy/forms/${currentForm.id}` : null)

  // ── The text, and the one before it ───────────────────────────────────────

  const { data: doc } = usePolicy<{ text?: string }>(current ? "text" : null, { state }, { id: current?.bill_id, document: current?.document_id })
  const { data: prior } = usePolicy<{ text?: string }>(diff && previous ? "text" : null, { state }, { id: previous?.bill_id, document: previous?.document_id })
  const text = doc?.text ?? null
  const readLayout = React.useMemo(() => (mode === "read" && text ? layoutBillText(printChangeMarks(text)) : null), [mode, text])
  const outline = (mode === "code" ? layout : readLayout)?.headings ?? []

  // ── Search, in three scopes ───────────────────────────────────────────────

  React.useEffect(() => {
    if (scope === "bill" || !query.trim() || !resolved) return
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
  }, [query, scope, state, session, resolved])


  const onMatches = React.useCallback((found: Match[]) => setMatches(found), [])
  const onLayout = React.useCallback((l: BillLayout) => setLayout(l), [])
  const readMatches = React.useMemo(() => {
    if (mode !== "read" || !readLayout || !query.trim()) return []
    const q = query.trim().toLowerCase()
    return readLayout.lines.flatMap((line, index) => (line.text.toLowerCase().includes(q) ? [{ line: index, from: 0, to: 0, text: line.text }] : [])).slice(0, 500)
  }, [mode, readLayout, query])
  const references = mode === "code" ? matches : readMatches

  const goto = (line: number) => {
    if (mode === "code") code.current?.goto(line)
    else document.querySelector(`[data-slot="bill-text"] > div:nth-child(${line + 1})`)?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  const openFromResults = (billId: number, documentId?: number) => {
    const row = inScope.find((r) => (documentId ? r.document_id === documentId : r.bill_id === billId))
    if (row) choose(row)
    else window.open(`/docs/bills/${billId}?state=${state}`, "_blank", "noopener")
  }

  // ── The rail ──────────────────────────────────────────────────────────────

  const rail = (
    <>
      <SidebarHeader className="p-2">
        <SidebarInput placeholder="Go to file…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Go to file" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Changes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {inScope.slice(0, 8).map((row) => {
                const amended = /amend|engross|enroll|chapter/i.test(row.version ?? "")
                return (
                  <SidebarMenuItem key={`change-${row.document_id}`}>
                    <SidebarMenuButton isActive={current?.document_id === row.document_id} onClick={() => choose(row)} title={`${row.bill_number} — ${row.title}`} className="justify-between gap-2">
                      <span className="truncate font-mono text-xs">
                        {row.bill_number}
                        {row.version ? ` · ${row.version}` : ""}
                      </span>
                      <span className={cn("shrink-0 text-xs", amended ? "text-amber-600" : "text-emerald-600")}>{amended ? "M" : "U"}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
              {!inScope.length && (
                <SidebarMenuItem>
                  <span className="px-2 text-xs text-muted-foreground">{isLoading ? "Loading…" : "Nothing in scope."}</span>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {stateName(state)} · {sessionTitle || "—"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {folders.map((folder) => {
                const open = folderOpen(folder.name)
                return (
                  <SidebarMenuItem key={folder.name}>
                    <SidebarMenuButton onClick={() => toggleFolder(folder.name)} title={folder.name} className="gap-1.5">
                      {open ? <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" /> : <ChevronRightIcon className="size-3.5 shrink-0 opacity-60" />}
                      {open ? <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" /> : <FolderIcon className="size-4 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{folder.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{folder.bills.length}</span>
                    </SidebarMenuButton>
                    {open && (
                      <SidebarMenu className="ml-3 border-l pl-2">
                        {folder.bills.map(({ bill_id, head, versions: v }) => {
                          const billOpen = openBills.has(bill_id)
                          return (
                            <SidebarMenuItem key={bill_id}>
                              <SidebarMenuButton
                                isActive={!billOpen && current?.bill_id === bill_id}
                                onClick={() => (v.length > 1 ? toggleBill(bill_id) : choose(head))}
                                title={`${head.bill_number} — ${head.title}`}
                                className="gap-1.5"
                              >
                                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate font-mono text-xs">{head.bill_number}</span>
                                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{v.length}</span>
                              </SidebarMenuButton>
                              {billOpen && (
                                <SidebarMenu className="ml-3 border-l pl-2">
                                  {v.map((version) => (
                                    <SidebarMenuItem key={version.document_id}>
                                      <SidebarMenuButton isActive={version.document_id === current?.document_id} onClick={() => choose(version)} title={`${version.version ?? "Original"} · ${fmtNumber(version.chars)} characters`}>
                                        <span className="truncate text-xs">{version.version ?? "Original"}</span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                                </SidebarMenu>
                              )}
                            </SidebarMenuItem>
                          )
                        })}
                      </SidebarMenu>
                    )}
                  </SidebarMenuItem>
                )
              })}
              {!folders.length && (
                <SidebarMenuItem>
                  <span className="px-2 text-xs text-muted-foreground">{isLoading ? "Loading…" : filter ? "Nothing matches." : `No bill text on file for ${stateName(state)} under these filters.`}</span>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {forms && !forms.empty && forms.rows.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Forms{agency ? ` · ${agency}` : ""}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {forms.rows.map((row) => (
                  <SidebarMenuItem key={`form-${row.id}`}>
                    <SidebarMenuButton isActive={currentForm?.id === row.id} onClick={() => setSelected({ kind: "form", id: row.id })} title={row.title ?? row.file} className="justify-between gap-2">
                      <span className="truncate font-mono text-xs">{row.number}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{row.agency}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </>
  )

  // ── The pane ──────────────────────────────────────────────────────────────

  const crumb = currentForm ? `${currentForm.number} · ${currentForm.agency}` : current ? `${current.bill_number} · ${current.version ?? "Original"}` : "—"
  const lineCount = text ? text.split("\n").length : 0
  const scopes: { value: Scope; label: string }[] = [
    { value: "bill", label: "This bill" },
    { value: "session", label: `This session` },
    { value: "all", label: "All of govblock" },
  ]
  const toggle = (value: string, active: boolean, onClick: () => void, label = value) => (
    <button key={value} type="button" data-active={active} onClick={onClick} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
      {label}
    </button>
  )

  return (
    <BlockShell
      rail={rail}
      contentClassName="overflow-hidden"
      title={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href={`/docs/bills?state=${state}`}>{stateName(state)}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href={`/docs/bills?state=${state}`}>{sessionTitle || "—"}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{crumb}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        current && (
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {toggle("read", mode === "read", () => setMode("read"), "Read")}
            {toggle("code", mode === "code", () => setMode("code"), "Code")}
          </div>
        )
      }
    >
      {currentForm ? (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/docs/forms/${currentForm.id}`} className="font-medium no-underline hover:underline">
                {currentForm.number} — {truncate(currentForm.title ?? currentForm.file, 110)}
              </Link>
              <span className="text-sm text-muted-foreground">
                {[currentForm.gov, currentForm.agency, currentForm.pages ? `${fmtNumber(currentForm.pages)} pages` : null, currentForm.fields ? `fillable · ${fmtNumber(currentForm.fields)} fields` : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            <Badge variant="outline" className="font-normal">
              Form
            </Badge>
          </div>
          {formDetail?.pdf ? <iframe src={formDetail.pdf} title={currentForm.number} className="min-h-96 flex-1 rounded-xl border bg-muted/50" /> : <p className="py-16 text-center text-sm text-muted-foreground">{formDetail?.pdfError ?? "Fetching the PDF…"}</p>}
        </div>
      ) : current ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* The file's header: what it is, then the toolbar GitHub puts on a file. */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/docs/bills/${current.bill_id}?state=${state}`} className="truncate text-sm font-medium no-underline hover:underline">
                {current.bill_number} — {truncate(current.title, 110)}
              </Link>
              <span className="truncate text-xs text-muted-foreground">
                {[current.status_desc, current.last_action_date ? fmtDate(current.last_action_date) : null, current.committee, `${fmtNumber(lineCount)} lines`, `${(current.chars / 1024).toFixed(current.chars > 10240 ? 0 : 1)} KB`].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {mode === "code" && (
                <>
                  <Button variant={diff ? "default" : "outline"} size="sm" disabled={!previous} title={previous ? `Against ${previous.version ?? "the previous version"}` : "This is the first version on file"} onClick={() => setDiff((d) => !d)}>
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
              <Button variant="ghost" size="icon-sm" aria-label="Download the text" disabled={!text} onClick={() => text && download(`${current.bill_number}-${(current.version ?? "original").replace(/\s+/g, "-").toLowerCase()}.txt`, text)}>
                <DownloadIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Open the bill" nativeButton={false} render={<a href={`/docs/bills/${current.bill_id}?state=${state}`} target="_blank" rel="noreferrer" />}>
                <ExternalLinkIcon />
              </Button>
            </div>
          </div>

          {/* History: the versions, newest first, like commits on a file. */}
          {versions.length > 1 && (
            <div className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b px-4 py-1.5">
              <span className="mr-1 text-xs text-muted-foreground">History</span>
              {versions.map((v, index) => (
                <button key={v.document_id} type="button" data-active={v.document_id === current.document_id} onClick={() => choose(v)} className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted data-[active=true]:bg-foreground data-[active=true]:text-background" title={`${fmtNumber(v.chars)} characters${v.fetched_at ? ` · fetched ${fmtDate(String(v.fetched_at).slice(0, 10))}` : ""}`}>
                  <span className="font-mono opacity-70">{String(versions.length - index).padStart(2, "0")}</span>
                  {v.version ?? "Original"}
                </button>
              ))}
            </div>
          )}

          {/* Search, in three scopes. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
            <div className="relative min-w-48 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (scope === "bill" && e.target.value.trim()) setPanel("references")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("")
                }}
                placeholder={scope === "bill" ? "Find in this file…" : scope === "session" ? `Search ${sessionTitle || "this session"}…` : "Search every jurisdiction…"}
                className="h-8 w-full rounded-md border bg-background pr-8 pl-8 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Search"
              />
              {query && (
                <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
              {scopes.map((s) =>
                toggle(
                  s.value,
                  scope === s.value,
                  () => {
                    setScope(s.value)
                    if (query.trim()) setPanel(s.value === "bill" ? "references" : "results")
                  },
                  s.label
                )
              )}
            </div>
            {query.trim() && scope === "bill" && <span className="text-xs text-muted-foreground tabular-nums">{fmtNumber(references.length)} in this file</span>}
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
                <CodeView ref={code} text={text} original={diff ? (prior?.text ?? null) : null} diff={diff && !!prior?.text} split={split} wrap={wrap} query={scope === "bill" ? query : ""} onMatches={onMatches} onLayout={onLayout} />
              ) : (
                <div className="h-full overflow-y-auto p-4">
                  <BillText text={text} version={current.version} date={current.last_action_date} />
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
                        <button key={`${h.line}-${h.label}`} type="button" onClick={() => goto(h.line)} className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-muted">
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
                        <button key={`${m.line}-${i}`} type="button" onClick={() => goto(m.line)} className="flex w-full items-start gap-2 px-3 py-1 text-left text-xs hover:bg-muted">
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
                        <button key={`t-${t.document_id}`} type="button" onClick={() => openFromResults(t.bill_id, t.document_id)} className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-muted">
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
                          <button key={`b-${b.bill_id}`} type="button" onClick={() => openFromResults(b.bill_id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted">
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
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">{isLoading ? "Loading…" : `No bill text on file for ${stateName(state)} under these filters.`}</p>
      )}
    </BlockShell>
  )
}
