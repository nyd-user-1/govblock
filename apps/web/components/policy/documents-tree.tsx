"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon, FileTextIcon, FolderIcon, FolderOpenIcon } from "lucide-react"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { billInScope, useScope, useSessionTitle } from "@/lib/policy/scope"
import { usePolicy } from "@/lib/policy/use-policy"
import { BillTextPane } from "@/components/policy/bill-text-pane"
import { BlockShell } from "@/components/policy/block-shell"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@govblock/ui/components/nova/breadcrumb"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// The file-tree block, put to work: Documents, the repository view of the
// texts we hold. Brendan, looking at GitHub: folders are committees, files
// are bills, a bill's versions are its history. The pane is
// `BillTextPane`, the same one the bill's file view on /create uses.
//
// On /create the jurisdiction tree took over this rail on 2026-09-03; this
// block still renders under /blocks and /view with its own tree of the
// newest texts in scope.

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

const NO_COMMITTEE = "Not yet referred"

export function DocumentsTree() {
  const { state, session, filters } = useScope()
  const sessionTitle = useSessionTitle(state, session)
  const { data: texts, isLoading } = usePolicy<TextRow[]>("texts", { state, session: filters.session }, { limit: 160 })

  const [selected, setSelected] = React.useState<number | null>(null)
  const [openFolders, setOpenFolders] = React.useState<Set<string>>(() => new Set())
  const [openBills, setOpenBills] = React.useState<Set<number>>(() => new Set())
  const [filter, setFilter] = React.useState("")

  const inScope = React.useMemo(() => (texts ?? []).filter((row) => billInScope(row, filters)), [texts, filters])
  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return inScope
    return inScope.filter((row) => row.bill_number.toLowerCase().includes(q) || row.title.toLowerCase().includes(q) || (row.committee ?? "").toLowerCase().includes(q))
  }, [inScope, filter])

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

  const current = (selected !== null ? inScope.find((row) => row.document_id === selected) : undefined) ?? inScope[0]
  const versions = React.useMemo(() => (current ? inScope.filter((r) => r.bill_id === current.bill_id).sort((a, b) => b.document_id - a.document_id) : []), [inScope, current])

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
    setSelected(row.document_id)
    setOpenBills((set) => new Set(set).add(row.bill_id))
    setOpenFolders((set) => new Set(set).add(row.committee || NO_COMMITTEE))
  }

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
                              <SidebarMenuButton isActive={!billOpen && current?.bill_id === bill_id} onClick={() => (v.length > 1 ? toggleBill(bill_id) : choose(head))} title={`${head.bill_number} — ${head.title}`} className="gap-1.5">
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
      </SidebarContent>
    </>
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
              <BreadcrumbPage>{current ? `${current.bill_number} · ${current.version ?? "Original"}` : "—"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      {current ? (
        <BillTextPane
          state={state}
          session={session}
          sessionTitle={sessionTitle}
          bill={current}
          versions={versions}
          current={current.document_id}
          onChoose={(id) => setSelected(id)}
          onOpenBill={(billId, documentId) => {
            const row = inScope.find((r) => (documentId ? r.document_id === documentId : r.bill_id === billId))
            if (row) choose(row)
            else window.open(`/docs/bills/${billId}?state=${state}`, "_blank", "noopener")
          }}
        />
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">{isLoading ? "Loading…" : `No bill text on file for ${stateName(state)} under these filters.`}</p>
      )}
    </BlockShell>
  )
}
