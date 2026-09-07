"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArchiveIcon, CalendarDaysIcon, ChartAreaIcon, CheckIcon, ChevronsUpDown, DatabaseIcon, FileTextIcon, InboxIcon, LayoutDashboardIcon, MenuIcon, TypeIcon } from "lucide-react"

import { readSort, SORTS } from "@/lib/workspace/sort"
import { AssistToggle } from "@/components/assist-panel"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { Button } from "@govblock/ui/components/ny4/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// The footer every shell wears (Brendan, 2026-09-07): the two things the
// floating pill used to hold, fixed to the bottom of the pane instead — the
// customizer's hamburger, then the mode you are in, with the chevrons the
// inbox's rail footer wears. The modes are the workspace's rooms: Data,
// Create, Typeset, Charts, Dashboards. Only Data has moved under /workspace so
// far; the rest go where they live today.

export type Workspace = "data" | "dashboards" | "inbox" | "calendar" | "finance" | "forms" | "documents" | "typeset" | "charts"

export const WORKSPACES: { key: Workspace; label: string; href: string; icon: typeof DatabaseIcon }[] = [
  { key: "data", label: "Data", href: "/workspace/data", icon: DatabaseIcon },
  { key: "dashboards", label: "Dashboards", href: "/workspace/dashboard", icon: LayoutDashboardIcon },
  { key: "inbox", label: "Agentic Inbox", href: "/workspace/inbox", icon: InboxIcon },
  { key: "calendar", label: "Calendar", href: "/workspace/calendar", icon: CalendarDaysIcon },
  { key: "forms", label: "Forms", href: "/workspace/forms", icon: FileTextIcon },
  { key: "documents", label: "Documents", href: "/workspace/documents", icon: ArchiveIcon },
  { key: "typeset", label: "Typeset", href: "/workspace/typeset", icon: TypeIcon },
  { key: "charts", label: "Charts", href: "/charts/area", icon: ChartAreaIcon },
]

/** The Filter chip: the same trigger as the mode switcher, ordering the page's rows. */
function FilterChip() {
  const { sort } = useUrlParams(["sort"] as const)
  const current = readSort(sort)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent"
          aria-label="How the rows are ordered"
        >
          {current ? SORTS.find((s) => s.value === current)?.label : "Filter"}
          <ChevronsUpDown className="size-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-max min-w-44 rounded-lg">
        {SORTS.map((s) => (
          <DropdownMenuItem key={s.value} className="whitespace-nowrap" onClick={() => writeUrlParams({ sort: s.value }, { history: "replace" })}>
            {s.label}
            {current === s.value && <CheckIcon className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem className="whitespace-nowrap" disabled={!current} onClick={() => writeUrlParams({ sort: null }, { history: "replace" })}>
          Clear
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The three links at the footer's right edge, on every shell. */
export function ShellFooterLinks({ className }: { className?: string }) {
  return (
    <div className={cn("ml-auto flex shrink-0 items-center gap-4 text-sm", className)}>
      <a href="/docs" className="not-hover:text-muted-foreground">
        About
      </a>
      <a href="/docs/api" className="not-hover:text-muted-foreground">
        API
      </a>
      <a href="/docs/datasets" className="not-hover:text-muted-foreground">
        Datasets
      </a>
    </div>
  )
}

export function WorkspaceFooter({
  mode,
  panelOpen,
  onTogglePanel,
  className,
  children,
}: {
  mode: Workspace
  panelOpen: boolean
  onTogglePanel: () => void
  className?: string
  /** The page's own controls, after the mode switcher: typeset's pages. */ children?: React.ReactNode
}) {
  const router = useRouter()
  const current = WORKSPACES.find((w) => w.key === mode) ?? WORKSPACES[0]
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1 lg:gap-2", className)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon" className="-ml-1 size-7 cursor-pointer" aria-label={panelOpen ? "Hide the customizer" : "Show the customizer"} aria-pressed={panelOpen} onClick={onTogglePanel}>
              <MenuIcon className="size-4" />
            </Button>
          }
        />
        <TooltipContent side="top" sideOffset={10}>
          Customizer
        </TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent"
            aria-label="Which workspace you are in"
          >
            {current.label}
            <ChevronsUpDown className="size-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-max min-w-44 rounded-lg">
          {WORKSPACES.map((w) => {
            const Icon = w.icon
            return (
              <DropdownMenuItem key={w.key} className="whitespace-nowrap" onClick={() => w.key !== mode && router.push(w.href)}>
                <Icon />
                {w.label}
                {w.key === mode && <CheckIcon className="ml-auto size-4" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {children && (
        <>
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          {children}
        </>
      )}
      {/* The Filter chip belongs to the Data pages alone (Brendan, 2026-09-07). */}
      {mode === "data" && (
        <>
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          <FilterChip />
        </>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <AssistToggle />
        <ShellFooterLinks className="ml-0" />
      </div>
    </div>
  )
}
