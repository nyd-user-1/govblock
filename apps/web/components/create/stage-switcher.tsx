"use client"

import * as React from "react"
import { ArchiveIcon, CheckIcon, ChevronsUpDown, FileTextIcon, InboxIcon, LayoutDashboardIcon, LayoutGridIcon, PaletteIcon, SlidersHorizontalIcon } from "lucide-react"

import type { Mode } from "@/components/create/main-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { cn } from "@govblock/ui/lib/utils"

// The switcher in the bottom-left pill, after the customizer's hamburger: what
// the stage is showing, with the chevrons the inbox's rail footer wears
// (Brendan, 2026-09-03, pointing at NavUser: "you basically already have the
// component"). State and Design are the customizer's two variants over the
// jurisdiction tree; Canvas is the tree's records as the large cards
// (Brendan, 2026-09-04: there was no affordance to reach them); the Agentic
// Inbox, the Dashboard, Forms and Documents are the roots beside it —
// Documents being the whole harvest, forms and documents together, that
// Forms cuts down to the 9,957 it can name.

export type Stage = Mode | "canvas" | "inbox" | "finance" | "forms" | "documents"

// Brendan, 2026-09-04: "Canvas, Data, Design" — the three ways of looking at
// the jurisdiction come first, in that order, then the roots beside it.
export const STAGE_LABEL: Record<Stage, string> = { canvas: "Canvas", state: "Data", design: "Design", inbox: "Agentic Inbox", finance: "Dashboard", forms: "Forms", documents: "Documents" }
export const STAGE_ICON: Record<Stage, typeof InboxIcon> = { canvas: LayoutGridIcon, state: SlidersHorizontalIcon, design: PaletteIcon, inbox: InboxIcon, finance: LayoutDashboardIcon, forms: FileTextIcon, documents: ArchiveIcon }
export const STAGE_GROUPS: Stage[][] = [
  ["canvas", "state", "design"],
  ["inbox", "finance", "forms", "documents"],
]
const LABEL = STAGE_LABEL
const ICON = STAGE_ICON

export function StageSwitcher({ stage, onStage, className }: { stage: Stage; onStage: (stage: Stage) => void; className?: string }) {
  const item = (value: Stage) => {
    const Icon = ICON[value]
    return (
      <DropdownMenuItem key={value} onClick={() => onStage(value)}>
        <Icon />
        {LABEL[value]}
        {stage === value && <CheckIcon className="ml-auto size-4" />}
      </DropdownMenuItem>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn("flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent", className)} aria-label="What the stage shows">
          {LABEL[stage]}
          <ChevronsUpDown className="size-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-48 rounded-lg">
        {STAGE_GROUPS.map((group, i) => (
          <React.Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>{group.map(item)}</DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
