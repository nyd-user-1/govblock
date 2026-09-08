"use client"

import * as React from "react"
import { CheckIcon, EllipsisVerticalIcon } from "lucide-react"

import { SIZE_CHOICES, SIZE_LABEL } from "@/lib/layout"
import { useCardGate } from "@/components/card-gate"
import { GridCellItems, useGridCell } from "@/components/workspace/grid"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/button"
import { Card } from "@govblock/ui/components/card"
import {
  Menu as DropdownMenu,
  MenuItem as DropdownMenuItem,
  MenuPanel as DropdownMenuContent,
  MenuRadioGroup as DropdownMenuRadioGroup,
  MenuRadioItem as DropdownMenuRadioItem,
  MenuSeparator as DropdownMenuSeparator,
  MenuSubmenu as DropdownMenuSub,
  MenuSubmenuPanel as DropdownMenuSubContent,
  MenuSubmenuTrigger as DropdownMenuSubTrigger,
  MenuTrigger as DropdownMenuTrigger,
} from "@govblock/ui/components/animate-ui/components/base/menu"

// Ported from livingston-v3 components/create/card-frame.tsx. The card chrome,
// once, for every card: CardFrame is the Card primitive with a component id;
// ComponentActions is the ⋮ menu. Every item is inert here — the menu shows
// the states a card in the editable, sourced position would show. Disabled
// items render disabled, never hidden.

export function CardFrame({
  id,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Card> & { id: string }) {
  return (
    <Card data-component={id} className={cn("relative", className)} {...props}>
      {children}
    </Card>
  )
}


/** A menu item that cannot be done without an account, and says so. */
function Gated({ action, variant }: { action: string; variant?: "destructive" }) {
  const gate = useCardGate()
  return (
    <DropdownMenuItem variant={variant} onClick={() => gate?.ask(action)}>
      {action}
    </DropdownMenuItem>
  )
}

const csvCell = (value: unknown) => {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * The one thing in this menu a reader may do without signing in, so it carries
 * a check to say so. A card that hands no rows over has nothing to give, and
 * the item asks for an account like the rest rather than downloading an empty
 * file.
 */
function Download({ rows, id, kind }: { rows?: readonly Record<string, unknown>[]; id?: string; kind: "csv" | "json" }) {
  const gate = useCardGate()
  const label = `Download data (${kind.toUpperCase()})`
  if (!rows?.length)
    return (
      <DropdownMenuItem onClick={() => gate?.ask(label)}>
        {label}
      </DropdownMenuItem>
    )
  const take = () => {
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))]
    const body =
      kind === "json"
        ? JSON.stringify(rows, null, 2)
        : [keys.join(","), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(","))].join("\n")
    const blob = new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${id ?? "card"}-${new Date().toISOString().slice(0, 10)}.${kind}`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <DropdownMenuItem onClick={take} className="justify-between">
      {label}
      <CheckIcon className="size-3.5 text-emerald-600" />
    </DropdownMenuItem>
  )
}

// Choose Session — the first item of every card's menu (Brendan, 2026-09-01: it
// used to be a footer picker on some cards). The jurisdiction's own sessions,
// newest first; choosing one writes the shared scope, so every card follows.
function ChooseSession() {
  const { state, session, resolved, setSession } = useJurisdiction()
  const { data } = usePolicy<{ session_id: number; bills: number; title: string }[]>(resolved ? "sessions" : null, { state })
  const sessions = data ?? []
  // "2025-2026 Regular Session" is how the record files a Congress; a reader
  // asking for a session of Congress is asking for the 119th. The ordinal is
  // arithmetic on the first year, not a table to keep up to date.
  const label = (title: string, id: number) => {
    if (state !== "US") return title || String(id)
    const year = Number((title.match(/(19|20)\d{2}/) ?? [])[0])
    if (!year) return title || String(id)
    const congress = Math.floor((year - 1789) / 2) + 1
    return `${congress}th Congress`
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Choose Session</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={session ? String(session) : ""} onValueChange={(value) => setSession(String(value))}>
          {sessions.map((row) => (
            <DropdownMenuRadioItem key={row.session_id} value={String(row.session_id)}>
              {label(row.title, row.session_id)}
            </DropdownMenuRadioItem>
          ))}
          {!sessions.length && <DropdownMenuItem disabled>No sessions</DropdownMenuItem>}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

export function ComponentActions({ className, children, rows, id }: { className?: string; children?: React.ReactNode; rows?: readonly Record<string, unknown>[]; id?: string }) {
  // On the workspace grid (Brendan, 2026-09-07) the card's own ⋮ is the grid's menu.
  const cell = useGridCell()
  if (cell)
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {children}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Component options" />}>
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max min-w-52">
            <ChooseSession />
            <DropdownMenuSeparator />
            <GridCellItems cell={cell} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Component options" />}>
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <ChooseSession />
          <Gated action="Edit Block" />
          <Gated action="Choose Block" />
          <Gated action="Save Block" />
          <DropdownMenuSeparator />
          <Gated action="Full Screen" />
          <Download rows={rows} id={id} kind="csv" />
          <Download rows={rows} id={id} kind="json" />
          <DropdownMenuSeparator />
          <Gated action="Rearrange" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Size</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value="">
                {SIZE_CHOICES.map((name) => (
                  <DropdownMenuRadioItem key={name} value={name}>
                    {SIZE_LABEL[name]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem disabled>Reset Component</DropdownMenuItem>
          <Gated action="Reset layout" />
          <Gated action="Delete Component" variant="destructive" />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
