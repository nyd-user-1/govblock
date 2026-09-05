"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"

// The footer's left side on every block: "Show 5 of 500 rows", a menu that
// sets how many rows a page holds (Brendan, 2026-09-05). Muted on hover, the
// same width as every other menu on the page.
export const PAGE_SIZES = [5, 10, 20, 50, 100]

export function PageSizeMenu({ size, total, onChange }: { size: number; total: number; onChange: (size: number) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
        }
      >
        Show {fmtNumber(Math.min(size, total))} of {fmtNumber(total)} {total === 1 ? "row" : "rows"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {PAGE_SIZES.map((n) => (
          <DropdownMenuCheckboxItem key={n} checked={n === size} onCheckedChange={() => onChange(n)}>
            Show {n}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
