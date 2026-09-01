"use client"

import * as React from "react"
import { AlertCircle, CheckCheck, Command, Inbox, Loader } from "lucide-react"

import { AGENTS } from "@/lib/agents/registry"
import { teaser, when, type Task, type TaskStatus } from "@/lib/agents/inbox"
import { NavUser } from "@/registry/blocks/sidebar-09/components/nav-user"
import { Label } from "@govblock/ui/components/ny4/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@govblock/ui/components/ny4/sidebar"
import { Switch } from "@govblock/ui/components/ny4/switch"

// The Agentic Inbox. This is shadcn's sidebar-09 mail block with its markup and
// classNames intact and its contents replaced: the icon rail filters, the
// second sidebar is the task list rather than a thread list, and each row is an
// agent run — who ran it, what it was asked, and what it is doing right now.
// Repurposed by content; nothing here was redesigned.

const FILTERS: { title: string; icon: typeof Inbox; status: TaskStatus | null }[] = [
  { title: "All", icon: Inbox, status: null },
  { title: "Running", icon: Loader, status: "running" },
  { title: "Delivered", icon: CheckCheck, status: "delivered" },
  { title: "Failed", icon: AlertCircle, status: "failed" },
]

export function AppSidebar({
  tasks,
  selected,
  // Not `onSelect`: Sidebar spreads a div's props, whose own onSelect would
  // intersect with this one and hand the callback a SyntheticEvent.
  onOpenTask,
  onClear,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  tasks: Task[]
  selected: string | null
  onOpenTask: (id: string) => void
  onClear: () => void
}) {
  const [activeItem, setActiveItem] = React.useState(FILTERS[0]!)
  const [query, setQuery] = React.useState("")
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const { setOpen } = useSidebar()

  const shown = tasks.filter((task) => {
    if (activeItem.status && task.status !== activeItem.status) return false
    if (unreadOnly && task.status !== "running") return false
    if (!query.trim()) return true
    const hay = `${task.agentName} ${task.tasking} ${task.run.text}`.toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  })

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="/agents">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Command className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">govblock</span>
                    <span className="truncate text-xs">Agentic Inbox</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {FILTERS.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{ children: item.title, hidden: false }}
                      onClick={() => {
                        setActiveItem(item)
                        setOpen(true)
                      }}
                      isActive={activeItem.title === item.title}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser
            user={{
              name: "This browser",
              email: `${tasks.length} task${tasks.length === 1 ? "" : "s"} kept locally`,
              avatar: "",
            }}
            onClear={onClear}
          />
        </SidebarFooter>
      </Sidebar>

      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">{activeItem.title}</div>
            <Label className="flex items-center gap-2 text-sm">
              <span>Running</span>
              <Switch
                className="shadow-none"
                checked={unreadOnly}
                onCheckedChange={(next: boolean) => setUnreadOnly(next)}
              />
            </Label>
          </div>
          <SidebarInput
            placeholder="Type to search…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {shown.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  {tasks.length
                    ? "Nothing here."
                    : `No tasks yet. New task sends one to ${AGENTS.filter((a) => a.inbox || a.agentic).map((a) => a.name).join(" or ")}, and it runs while this tab is open.`}
                </p>
              )}
              {shown.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => onOpenTask(task.id)}
                  data-active={selected === task.id}
                  className="flex w-full flex-col items-start gap-2 border-b p-4 text-left text-sm leading-tight whitespace-nowrap last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                >
                  <div className="flex w-full items-center gap-2">
                    <span>{task.agentName}</span>{" "}
                    <span className="ml-auto text-xs">{when(task.createdAt)}</span>
                  </div>
                  <span className="w-[260px] truncate font-medium">{task.tasking}</span>
                  <span className="line-clamp-2 w-[260px] text-xs whitespace-break-spaces">
                    {task.status === "running" && "Running · "}
                    {task.status === "failed" && "Failed · "}
                    {teaser(task)}
                  </span>
                </button>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
