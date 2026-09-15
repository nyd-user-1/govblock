"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FolderIcon, LibraryIcon } from "lucide-react"

import type { ExpressionLine } from "@/lib/typeset/expression-document"
import { LIBRARY_ROOT, libraryHref, workHref } from "@/lib/xml/library"
import { versionName } from "@/lib/typeset/versions"
import { TypesetFrame } from "@/components/workspace/typeset-frame"
import { TypesetXmlReader, type XmlMeta } from "@/components/workspace/typeset-xml-reader"
import { ForkAction } from "@/components/workspace/typeset-fork-action"
import { TypesetWorkChrome } from "@/components/workspace/typeset-file-chrome"
import { StaticToolbar } from "@/components/workspace/typeset-toolbar"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

// A Work opened by its address in the XML view (window 4, 2026-09-14):
// /workspace/typeset/work/<address>. The stored Expression, drawn by the same
// reader as a bill printing, with the library it sits in and the Work's
// DocHistory in the rail. A bill's Work also opens in Typeset's own views.

export type TypesetWorkProps = {
  work: string
  expression: string
  label: string
  kind: string
  prefix: { address: string; label: string }
  portion: string | null
  history: ExpressionLine[]
  snapshot: string | null
  meta: XmlMeta | null
  /** Null when the reader may not open it; `door` says what would. */
  jsonUrl: string | null
  door: "sign-in" | "plan" | null
  billHref: string | null
}

const fmtDay = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })

function WorkRail({ work, expression, kind, prefix, history }: Pick<TypesetWorkProps, "work" | "expression" | "kind" | "prefix" | "history">) {
  const router = useRouter()
  const newest = [...history].reverse()
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Library</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => router.push(LIBRARY_ROOT)}>
                <LibraryIcon />
                <span className="flex-1 truncate">Every library</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => router.push(libraryHref(prefix.address))}>
                <FolderIcon />
                <span className="flex-1 truncate">{prefix.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Versions</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {newest.map((line) => (
              <SidebarMenuItem key={line.expression}>
                <SidebarMenuButton isActive={line.expression === expression} onClick={() => router.push(workHref(`${work}@${line.expression}`))}>
                  {kind === "bill" && <span className="flex-1 truncate">{versionName(line.unit)}</span>}
                  <span className={kind === "bill" ? "text-xs text-muted-foreground tabular-nums" : "flex-1 truncate tabular-nums"}>{fmtDay(line.date)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

export function TypesetWork(props: TypesetWorkProps) {
  const { label, prefix, portion, snapshot, meta, jsonUrl, door, billHref } = props
  const billId = billHref ? Number(/\/bill\/(\d+)/.exec(billHref)?.[1]) || null : null
  return (
    <TypesetFrame
      billId={billId}
      rail={<WorkRail {...props} />}
      crumbs={[{ label: "Library", href: LIBRARY_ROOT }, { label: prefix.label, href: libraryHref(prefix.address) }, { label }]}
    >
      {jsonUrl ? (
        // The Git view's file row and the toolbar over the reader (2026-09-14); fork the unit under the pointer from this Expression (window 5).
        <TypesetWorkChrome work={props.work} expression={props.expression} label={label} history={props.history} toolbar={<StaticToolbar xml={{ editor: null }} />}>
        <ForkAction expression={props.expression}>
          <TypesetXmlReader
            jsonUrl={jsonUrl}
            snapshot={snapshot}
            meta={meta}
            portion={portion}
            cite={{ jurisdiction: props.work.split("/")[1] ?? "us", work: props.work, at: meta?.date?.slice(0, 10) ?? null, citing: `${props.work}@${props.expression}` }}
          />
        </ForkAction>
        </TypesetWorkChrome>
      ) : (
        <p className="p-8 text-sm text-muted-foreground">{door === "sign-in" ? "Sign in to read this." : "Reading this takes a plan that covers its jurisdiction."}</p>
      )}
    </TypesetFrame>
  )
}
