"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ArrowUpRight, Copy, MoreHorizontal } from "lucide-react"

import { fmtCompact, fmtDate } from "@/lib/format"
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

// The member page's two data tables on shadcn's shape: a member's roll calls
// (chosen over the plain table on 2026-09-05: "The Roll Call Table stays") and
// their FEC totals by cycle.

export type RollCallRow = {
  id: string
  date: string | null
  roll: string | null
  bill: string | null
  billId: number | null
  billUrl: string | null
  question: string | null
  position: string | null
  result: string | null
}

const rollCallColumns: ColumnDef<RollCallRow>[] = [
  selectColumn<RollCallRow>(),
  {
    accessorKey: "date",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Date
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => <div className="whitespace-nowrap">{row.original.date ? fmtDate(row.original.date) : "—"}</div>,
  },
  {
    accessorKey: "roll",
    header: "Roll call",
    cell: ({ row }) => <div className="tabular-nums">{row.getValue("roll") ?? "—"}</div>,
  },
  {
    accessorKey: "bill",
    header: "Bill",
    cell: ({ row }) => {
      const r = row.original
      const link = "underline-offset-4 hover:underline"
      if (r.bill && r.billId)
        return (
          <Link href={`/docs/bills/${r.billId}`} className={link}>
            {r.bill}
          </Link>
        )
      if (r.bill && r.billUrl)
        return (
          <a href={r.billUrl} target="_blank" rel="noopener noreferrer" className={link}>
            {r.bill}
          </a>
        )
      // A roll call with no bill shows its question, cut to the column so
      // "On Agreeing to the Amendment" does not widen every row.
      return (
        <div className="max-w-40 truncate" title={r.question ?? undefined}>
          {r.bill ?? r.question ?? "—"}
        </div>
      )
    },
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => <div>{row.getValue("position") ?? "—"}</div>,
  },
  {
    accessorKey: "result",
    header: () => <div className="text-right">Result</div>,
    cell: ({ row }) => <div className="text-right font-medium">{row.getValue("result") ?? "—"}</div>,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const r = row.original
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
          {/* w-44, as the demo on ui.shadcn.com sets it: wide enough that an
              item never wraps. A label lives inside a group in Base UI. */}
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(r.bill ?? r.question ?? "")} disabled={!r.bill && !r.question}>
                <Copy />
                Bill No.
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!r.billId} render={r.billId ? <Link href={`/docs/bills/${r.billId}`} /> : undefined}>
                <ArrowUpRight />
                View Bill
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function RollCallTable({ rows, menu }: { rows: RollCallRow[]; menu?: React.ReactNode }) {
  return <DataTable columns={rollCallColumns} rows={rows} filterColumn="bill" filterPlaceholder="Filter bills..." menu={menu} />
}

/** What the Copy button puts on the clipboard: the table as tab-separated text. */
export const rollCallText = (rows: RollCallRow[]) =>
  ["Date\tRoll call\tBill\tPosition\tResult", ...rows.map((r) => [r.date ? fmtDate(r.date) : "", r.roll ?? "", r.bill ?? r.question ?? "", r.position ?? "", r.result ?? ""].join("\t"))].join("\n")

export type FinanceRow = {
  cycle: number
  receipts: number
  disbursements: number
  cash_on_hand_end: number
  /** The FEC candidate id, for the row's link to fec.gov. */
  fecId?: string | null
}

const cycleLabel = (cycle: number) => `${cycle - 1}–${cycle}`

const money = (key: keyof FinanceRow, label: string): ColumnDef<FinanceRow> => ({
  accessorKey: key,
  header: () => <div className="text-right">{label}</div>,
  cell: ({ row }) => <div className="text-right font-medium">{fmtCompact(row.getValue(key))}</div>,
})

const financeColumns: ColumnDef<FinanceRow>[] = [
  selectColumn<FinanceRow>(),
  {
    id: "cycle",
    accessorFn: (row) => cycleLabel(row.cycle),
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Cycle
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => <div className="whitespace-nowrap">{cycleLabel(row.original.cycle)}</div>,
  },
  money("receipts", "Raised"),
  money("disbursements", "Spent"),
  money("cash_on_hand_end", "On hand"),
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const r = row.original
      const fec = r.fecId ? `https://www.fec.gov/data/candidate/${r.fecId}/?cycle=${r.cycle}` : null
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
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(financeText([r]).split("\n")[1])}>
                <Copy />
                Cycle
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!fec} render={fec ? <a href={fec} target="_blank" rel="noopener noreferrer" /> : undefined}>
                <ArrowUpRight />
                View on FEC
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function FinanceTable({ rows }: { rows: FinanceRow[] }) {
  return <DataTable columns={financeColumns} rows={rows} filterColumn="cycle" filterPlaceholder="Filter cycles..." />
}

export const financeText = (rows: FinanceRow[]) =>
  ["Cycle\tRaised\tSpent\tOn hand", ...rows.map((r) => [cycleLabel(r.cycle), fmtCompact(r.receipts), fmtCompact(r.disbursements), fmtCompact(r.cash_on_hand_end)].join("\t"))].join("\n")
