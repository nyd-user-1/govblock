"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ArrowUpRight, Copy, MoreHorizontal } from "lucide-react"

import { fmtDate } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"
import { DataTable, selectColumn } from "@/components/policy/data-table"

// The bill page's two data tables on shadcn's shape, as the member page's
// roll calls and finance are (2026-09-05): what has happened to the bill, and
// how each chamber voted on it. Each row's ⋯ menu is the same width as every
// menu on these pages, with a copy item and a view item.

/* ---- the row menu -------------------------------------------------------- */

function RowMenu({
  copy,
  copyLabel,
  view,
}: {
  copy: string
  copyLabel: string
  view: { label: string; href: string | null; external?: boolean }
}) {
  const link = view.href
    ? view.external
      ? <a href={view.href} target="_blank" rel="noopener noreferrer" />
      : <Link href={view.href} />
    : undefined
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal />
          </Button>
        }
      />
      {/* At least the demo's w-44, and as wide as its widest item, so an item
          never wraps (Brendan, 2026-09-05). A label lives inside a group in
          Base UI. */}
      <DropdownMenuContent align="end" className="w-max min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem className="whitespace-nowrap" onClick={() => navigator.clipboard.writeText(copy)} disabled={!copy}>
            <Copy />
            {copyLabel}
          </DropdownMenuItem>
          <DropdownMenuItem className="whitespace-nowrap" disabled={!view.href} render={link}>
            <ArrowUpRight />
            {view.label}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const sortable = (label: string) =>
  function Header({ column }: { column: { toggleSorting: (desc: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
    return (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        {label}
        <ArrowUpDown />
      </Button>
    )
  }

/* ---- actions ------------------------------------------------------------- */

/**
 * The Congressional Record page an action cites.
 *
 * congress.gov prints the citation inside the action's own text — "(text: CR
 * H3059-3143)", "(consideration: CR S4072)" — and links it. Nothing in
 * BILLSTATUS carries the URL, so it is built the way congress.gov builds it:
 * the volume is the year less 1854 (2025 is volume 171, checked against
 * /volume-171/house-section/page/H3059, which is the debate on the Senate
 * amendment to H.R. 1), and the letter names the section.
 *
 * Only H, S and E are linked. D is the Daily Digest, which is paged separately,
 * and anything else is left as the text it already is — a citation that reads
 * is better than a link that 404s.
 */
const CR_SECTION: Record<string, string> = { H: "house-section", S: "senate-section", E: "extensions-of-remarks-section" }
export function recordHref(page: string, date: string | null | undefined) {
  const year = Number(String(date ?? "").slice(0, 4))
  const section = CR_SECTION[page.slice(0, 1).toUpperCase()]
  if (!section || !Number.isFinite(year) || year < 1990) return null
  return `https://www.congress.gov/congressional-record/volume-${year - 1854}/${section}/page/${page}`
}

const CR_CITATION = /\bCR\s+([HSED]\d+)(-(?:[HSED]?\d+))?/g

/** The first Record page an action cites, linked, for the row's menu. */
export function firstRecordHref(text: string, date: string | null | undefined) {
  for (const m of text.matchAll(CR_CITATION)) {
    const href = recordHref(m[1], date)
    if (href) return href
  }
  return null
}

/** An action's text with its Record citations turned into links. */
export function withRecordLinks(text: string, date: string | null | undefined) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(CR_CITATION)) {
    const at = m.index ?? 0
    const href = recordHref(m[1], date)
    parts.push(text.slice(last, at))
    if (href) {
      parts.push(
        <a key={at} href={href} target="_blank" rel="noopener noreferrer">
          {m[0]}
        </a>
      )
    } else {
      parts.push(m[0])
    }
    last = at + m[0].length
  }
  if (!parts.length) return text
  parts.push(text.slice(last))
  return parts
}

export type ActionTableRow = {
  id: string
  date: string
  time: string | null
  chamber: string
  text: string
  committees: { code: string | null; name: string }[]
  /** The roll call the action produced, when a chamber recorded one. */
  roll: { label: string; tally: string | null; clerk: string | null } | null
}

const actionColumns: ColumnDef<ActionTableRow>[] = [
  selectColumn<ActionTableRow>(),
  {
    accessorKey: "date",
    header: sortable("Date"),
    cell: ({ row }) => (
      <div className="whitespace-nowrap tabular-nums">
        {row.original.date ? fmtDate(row.original.date) : "—"}
        {row.original.time && <span className="block text-xs text-muted-foreground">{row.original.time.slice(0, 5)}</span>}
      </div>
    ),
  },
  {
    accessorKey: "chamber",
    header: "Chamber",
    cell: ({ row }) => <div className="whitespace-nowrap">{row.original.chamber || "—"}</div>,
  },
  {
    accessorKey: "text",
    header: "Action",
    cell: ({ row }) => {
      const r = row.original
      return (
        <div className="min-w-56">
          {withRecordLinks(r.text, r.date)}
          {(r.committees.length > 0 || r.roll) && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {r.committees.map((cm) => (
                <span key={cm.code ?? cm.name}>
                  {cm.code ? (
                    <Link href={`/docs/committees/${cm.code}`} className="underline-offset-4 hover:underline">
                      {cm.name}
                    </Link>
                  ) : (
                    cm.name
                  )}{" "}
                </span>
              ))}
              {r.roll && (
                <span>
                  <a href="#votes" className="underline-offset-4 hover:underline">
                    {r.roll.label}
                  </a>
                  {r.roll.tally && <span className="tabular-nums"> {r.roll.tally}</span>}
                </span>
              )}
            </span>
          )}
        </div>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const r = row.original
      const record = firstRecordHref(r.text, r.date)
      const view = r.roll?.clerk
        ? { label: "View Roll Call", href: r.roll.clerk, external: true }
        : record
          ? { label: "View Record", href: record, external: true }
          : { label: "View Roll Call", href: null }
      return <RowMenu copy={`${r.date}\t${r.chamber}\t${r.text}`} copyLabel="Action" view={view} />
    },
  },
]

export function ActionTable({ rows }: { rows: ActionTableRow[] }) {
  return <DataTable columns={actionColumns} rows={rows} filterColumn="text" filterPlaceholder="Filter actions..." />
}

/* ---- votes ---------------------------------------------------------------- */

export type VoteTableRow = {
  id: string
  date: string | null
  chamber: string
  question: string
  yea: number
  nay: number
  nv: number
  absent: number
  /** The roll call on legiscan.com, which holds every position. */
  href: string | null
}

const tally = (key: "yea" | "nay", label: string): ColumnDef<VoteTableRow> => ({
  accessorKey: key,
  header: () => <div className="text-right">{label}</div>,
  cell: ({ row }) => <div className="text-right font-medium tabular-nums">{row.original[key]}</div>,
})

const voteColumns: ColumnDef<VoteTableRow>[] = [
  selectColumn<VoteTableRow>(),
  {
    accessorKey: "date",
    header: sortable("Date"),
    cell: ({ row }) => <div className="whitespace-nowrap tabular-nums">{row.original.date ? fmtDate(row.original.date) : "—"}</div>,
  },
  {
    accessorKey: "chamber",
    header: "Chamber",
    cell: ({ row }) => <div className="whitespace-nowrap">{row.original.chamber || "—"}</div>,
  },
  {
    accessorKey: "question",
    header: "Question",
    cell: ({ row }) => <div className="min-w-40">{row.original.question || "—"}</div>,
  },
  tally("yea", "Yea"),
  tally("nay", "Nay"),
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const r = row.original
      return (
        <RowMenu
          copy={[r.date ? fmtDate(r.date) : "", r.chamber, r.question, `Yea ${r.yea}`, `Nay ${r.nay}`, `NV ${r.nv}`, `Absent ${r.absent}`].join("\t")}
          copyLabel="Roll Call"
          view={{ label: "View Roll Call", href: r.href, external: true }}
        />
      )
    },
  },
]

export function VoteTable({ rows }: { rows: VoteTableRow[] }) {
  return <DataTable columns={voteColumns} rows={rows} filterColumn="question" filterPlaceholder="Filter roll calls..." />
}
