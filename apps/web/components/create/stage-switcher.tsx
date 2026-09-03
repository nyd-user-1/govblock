"use client"

import { CheckIcon, ChevronsUpDown, CircleDollarSignIcon, FileTextIcon, InboxIcon, PaletteIcon, SlidersHorizontalIcon } from "lucide-react"

import type { Mode } from "@/components/create/main-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { cn } from "@govblock/ui/lib/utils"

// The switcher in the bottom-left pill, after the customizer's hamburger: what
// the stage is showing, with the chevrons the inbox's rail footer wears
// (Brendan, 2026-09-03, pointing at NavUser: "you basically already have the
// component"). State and Design are the customizer's two variants over the
// jurisdiction tree; Intelligence, Finance and Forms are the roots beside it.

export type Stage = Mode | "inbox" | "finance" | "forms"

const LABEL: Record<Stage, string> = { state: "State", design: "Design", inbox: "Intelligence", finance: "Finance", forms: "Forms" }
const ICON: Record<Stage, typeof InboxIcon> = { state: SlidersHorizontalIcon, design: PaletteIcon, inbox: InboxIcon, finance: CircleDollarSignIcon, forms: FileTextIcon }

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
        <DropdownMenuGroup>
          {item("state")}
          {item("design")}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {item("inbox")}
          {item("finance")}
          {item("forms")}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
