"use client"

import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { ChamberSeal } from "@/components/policy/imagery"
import { Badge } from "@govblock/ui/components/nova/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@govblock/ui/components/nova/breadcrumb"
import { Separator } from "@govblock/ui/components/nova/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@govblock/ui/components/nova/sidebar"

// The file-tree block, put to work: Documents. Lives here rather than in a
// block so both registries' sidebar-11 render the same thing, and built on
// base-nova's primitives so it looks right in a block view (the registry
// base's take their look from a `.style-*` scope a view does not provide).
//
// Brendan: "this block seems really good for documents… its folder side rail
// is perfect for versioning and organization." What we hold that is versioned
// is bill text: a bill collects Original, Amended A, Amended B and Enrolled as
// it moves, which is what a tree with a Changes panel is for.
//
// Tree:    jurisdiction › session › bill › its text versions
// Changes: the newest versions across the scope — M where a bill already had
//          one (amended), U where this is its first (new).
// Pane:    the chosen version, with the breadcrumb naming where it sits.
//
// Forms, reports and PDFs hang off the same tree when we hold them: they are
// another folder under the session, with the document as the leaf.

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
}

export function DocumentsTree() {
  const { state, session } = useJurisdiction()
  const filters = { state }
  const { data: texts, isLoading } = usePolicy<TextRow[]>("texts", filters, {
    limit: 80,
  })
  const [openBill, setOpenBill] = React.useState<number | null>(null)
  const [selected, setSelected] = React.useState<number | null>(null)

  // The tree: one folder per bill, its versions inside, newest first.
  const bills = React.useMemo(() => {
    const byBill = new Map<number, { bill: TextRow; versions: TextRow[] }>()
    for (const row of texts ?? []) {
      const entry = byBill.get(row.bill_id) ?? { bill: row, versions: [] }
      entry.versions.push(row)
      byBill.set(row.bill_id, entry)
    }
    return [...byBill.values()]
  }, [texts])

  const current =
    (texts ?? []).find((row) => row.document_id === selected) ??
    (texts ?? [])[0]

  const { data: bill } = usePolicy<{ texts: TextRow[]; text?: string }>(
    current ? "text" : null,
    filters,
    { id: current?.bill_id, document: current?.document_id }
  )

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Changes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(texts ?? []).slice(0, 8).map((row) => {
                  const amended = /amend/i.test(row.version ?? "")
                  return (
                    <SidebarMenuItem key={`change-${row.document_id}`}>
                      <SidebarMenuButton
                        onClick={() => {
                          setSelected(row.document_id)
                          setOpenBill(row.bill_id)
                        }}
                        title={`${row.bill_number} — ${row.title}`}
                        className="justify-between gap-2"
                      >
                        <span className="truncate font-mono text-xs">
                          {row.bill_number}
                          {row.version ? ` · ${row.version}` : ""}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {amended ? "M" : "U"}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>
              {stateName(state)} · {session}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {bills.map(({ bill: row, versions }) => (
                  <SidebarMenuItem key={row.bill_id}>
                    <SidebarMenuButton
                      onClick={() =>
                        setOpenBill((open) =>
                          open === row.bill_id ? null : row.bill_id
                        )
                      }
                      title={`${row.bill_number} — ${row.title}`}
                      className="justify-between gap-2"
                    >
                      <span className="truncate font-mono text-xs">
                        {row.bill_number}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {versions.length}
                      </span>
                    </SidebarMenuButton>
                    {openBill === row.bill_id && (
                      <SidebarMenu className="ml-3 border-l pl-2">
                        {versions.map((version) => (
                          <SidebarMenuItem key={version.document_id}>
                            <SidebarMenuButton
                              isActive={
                                version.document_id === current?.document_id
                              }
                              onClick={() => setSelected(version.document_id)}
                              title={`${version.version ?? "Original"} · ${fmtNumber(version.chars)} characters`}
                            >
                              <span className="truncate text-xs">
                                {version.version ?? "Original"}
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    )}
                  </SidebarMenuItem>
                ))}
                {!bills.length && (
                  <SidebarMenuItem>
                    <span className="px-2 text-xs text-muted-foreground">
                      {isLoading
                        ? "Loading…"
                        : `No bill text on file for ${stateName(state)}.`}
                    </span>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/docs/bills?state=${state}`}>
                  {stateName(state)}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={`/docs/bills?state=${state}`}>
                  {session}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {current
                    ? `${current.bill_number} · ${current.version ?? "Original"}`
                    : "—"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {current ? (
            <>
              <div className="flex flex-wrap items-start gap-3">
                <ChamberSeal state={state} chamber={current.body} size={40} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/docs/bills/${current.bill_id}`}
                    className="font-medium no-underline hover:underline"
                  >
                    {current.bill_number} — {truncate(current.title, 110)}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {[
                      current.status_desc,
                      current.last_action_date
                        ? fmtDate(current.last_action_date)
                        : null,
                      `${fmtNumber(current.chars)} characters`,
                      current.fetched_at
                        ? `fetched ${fmtDate(String(current.fetched_at).slice(0, 10))}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <Badge variant="outline" className="font-normal">
                  {current.version ?? "Original"}
                </Badge>
              </div>
              <pre className="min-h-96 flex-1 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {bill?.text ? bill.text.slice(0, 20000) : "Loading the text…"}
              </pre>
            </>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {isLoading
                ? "Loading…"
                : `No bill text on file for ${stateName(state)}.`}
            </p>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
