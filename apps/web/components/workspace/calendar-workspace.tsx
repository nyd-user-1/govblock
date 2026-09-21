"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react"
import { CalendarDate } from "@internationalized/date"

import { AccountFooter } from "@/components/admin/account-footer"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import { CalendarProvider, useCalendar, useCalendarEvents } from "@/components/calendar/calendar-provider"
import { usePublicSource, useWorkspaceSource, MAX_ADDED } from "@/components/calendar/hearing-source"
import { CalendarBoard } from "@/components/policy/calendar-board"
import { FlagChip } from "@/components/policy/imagery"
import { StatePicker } from "@/components/state-switcher"
import { CalendarPane, Segmented, ViewToggle, useCalendarTitle } from "@/components/workspace/calendar-embed"
import { calendarDotClasses } from "@/lib/calendar/calendars"
import { useAccount } from "@/lib/auth/use-account"
import { doorHref, entitled } from "@/lib/entitlements"
import { CONGRESS, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { LegislativeFields } from "@/components/create/fields"
import { LocksProvider } from "@/components/create/locks"
import { BlockShell, ShellFooterProvider } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { useScope, type ScopeKey } from "@/lib/policy/scope"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"
import { Separator } from "@govblock/ui/components/nova/separator"
import { FieldGroup } from "@govblock/ui/components/nova/field"
import { SidebarContent, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /workspace/calendar (Brendan, 2026-09-07): the dashboard's Calendar page —
// paceui's calendar app on the record's hearings, the month grid, the mini
// calendar and the kinds of event in its own left column — as it is, placed
// in the workspace's shell: the stage, the customizer of legislative fields,
// the shell's footer with the hamburger and the mode. The rail wears the
// dashboard rail's header and account block, starts closed, and holds the
// mini calendar and the list of calendars (Brendan's capture,
// workspace-calendar.html, 2026-09-07); the month has the stage to itself.
//
// The one calendar since 2026-09-21 (Brendan: "we have two calendars, we are
// going to combine them"). This design kept whole, and in its stage
// /calendar's views in place of the dashboard's month: the month that scrolls
// without end, the week and the day, a double click to add an event, the
// dot-and-time rows in the five calendars' colours. The month and year moved
// up into the path bar, which stands still while the weeks scroll; the old
// toolbar's arrows, Today, count, Availability and Add Event went, and with
// them the stage's padding, so the grid sits against its frame.

const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Six weeks from the Monday on or before the first of the month. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

/** The rail's mini calendar and list of calendars, on the one calendar's state: a day goes there, a checkbox hides what it claims, the + adds a jurisdiction's calendar. */
function CalendarSide({ className }: { className?: string }) {
  const router = useRouter()
  const { date, visibleMonth, view, pathFor, navigate } = useCalendar()
  const { calendars, hiddenCalendars, toggleCalendar, events, eventsForDay, state, added, addJurisdiction, removeJurisdiction } = useCalendarEvents()
  const { reader } = useJurisdiction()
  const today = React.useMemo(() => new Date(), [])
  // The mini month follows the stage: the month docked while it scrolls, the date otherwise.
  const focus = view === "month" ? (visibleMonth ?? date) : date
  const [mini, setMini] = React.useState(() => new Date(focus.year, focus.month - 1, 1))
  React.useEffect(() => setMini(new Date(focus.year, focus.month - 1, 1)), [focus.year, focus.month])
  const cells = monthGrid(mini.getFullYear(), mini.getMonth())
  const kinds = calendars.filter((c) => c.id !== "mine")
  const claimed = React.useMemo(() => new Set(events.flatMap((e) => [e.calendarId, ...(e.claims ?? [])])), [events])
  const [picking, setPicking] = React.useState(false)
  const active = reader.home && reader.home !== CONGRESS ? [CONGRESS, reader.home] : [CONGRESS]
  // Congress for everyone, the home state once signed in, a third on a plan: the rule is lib/entitlements.ts's, and a jurisdiction it closes leads to its door.
  const pick = (code: string) => {
    setPicking(false)
    if (code === state || added.includes(code)) return
    const allowed = entitled(reader, { state: code, entity: "calendar" })
    if (allowed !== "open") return router.push(doorHref(allowed))
    addJurisdiction?.(code)
  }
  const full = added.length >= MAX_ADDED
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">{mini.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon-xs" aria-label="Previous month" onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() - 1, 1))}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Next month" onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() + 1, 1))}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0 text-center text-[11px]">
          {DAY_NAMES.map((d) => (
            <span key={d} className="py-1 text-muted-foreground">
              {d}
            </span>
          ))}
          {cells.map((d) => (
            <button
              key={d.getTime()}
              type="button"
              onClick={() => navigate(pathFor(new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())))}
              className={cn("relative rounded-md py-1 hover:bg-muted", d.getMonth() !== mini.getMonth() && "text-muted-foreground/50", sameDay(d, today) && "bg-primary text-primary-foreground hover:bg-primary")}
            >
              {d.getDate()}
              {eventsForDay(d).length > 0 && <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />}
            </button>
          ))}
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase">My Calendar</p>
          <Popover open={picking} onOpenChange={setPicking}>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon-xs" className="-mr-1 text-muted-foreground" disabled={full} aria-label="Add a jurisdiction's calendar" title={full ? `${MAX_ADDED} added, the most at once` : "Add a jurisdiction's calendar"}>
                  <PlusIcon />
                </Button>
              }
            />
            <PopoverContent align="start" className="w-64 p-0" aria-label="Jurisdictions">
              <StatePicker state={state} active={active} onSelect={pick} className="rounded-lg!" />
            </PopoverContent>
          </Popover>
        </div>
        {kinds.map((k) => (
          <label key={k.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={!hiddenCalendars.includes(k.id)} onCheckedChange={() => toggleCalendar(k.id)} />
            <span className={cn("size-2 rounded-full", calendarDotClasses[k.color])} />
            <span className="grow">{k.name}</span>
            {!hiddenCalendars.includes(k.id) && !claimed.has(k.id) && <span className="text-[10px] text-muted-foreground">none</span>}
          </label>
        ))}
        {/* The jurisdictions on the calendar: the one in scope, then each one added, which a checkbox hides and the cross takes off. */}
        {added.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Checkbox checked disabled aria-label={stateName(state)} />
            <FlagChip state={state} width={16} />
            <span className="grow truncate">{state === CONGRESS ? "U.S. Congress" : stateName(state)}</span>
          </div>
        )}
        {added.map((code) => (
          <div key={code} className="group/added flex items-center gap-2 text-sm">
            <label className="flex min-w-0 grow items-center gap-2">
              <Checkbox checked={!hiddenCalendars.includes(`j:${code}`)} onCheckedChange={() => toggleCalendar(`j:${code}`)} />
              <FlagChip state={code} width={16} />
              <span className="truncate">{stateName(code)}</span>
            </label>
            <button type="button" aria-label={`Remove ${stateName(code)}`} onClick={() => removeJurisdiction?.(code)} className="text-muted-foreground opacity-0 transition-opacity group-hover/added:opacity-100 hover:text-foreground focus-visible:opacity-100">
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarRail() {
  const router = useRouter()
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <Link href="/workspace/calendar" className="flex items-center gap-2.5">
          <p className="text-xl font-semibold">Calendar</p>
        </Link>
      </SidebarHeader>
      {/* Brendan, 2026-09-07, from his capture: the dashboard card's mini calendar and list of calendars, in the rail. */}
      <SidebarContent className="no-scrollbar">
        <CalendarSide className="px-4 py-2" />
      </SidebarContent>
      <AccountFooter go={(page) => router.push(dashboardHref(page))} />
    </>
  )
}

function CalendarCustomizer({ filters, setFilters }: { filters: ReturnType<typeof useScope>["filters"]; setFilters: (patch: Partial<Record<ScopeKey, string>>) => void }) {
  return (
    <Card className="dark isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)" size="sm">
      <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
        <CardTitle className="text-base">Calendar</CardTitle>
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px max-md:px-3 md:flex-col md:gap-3.25">
          <LegislativeFields filters={filters} setFilters={setFilters} />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

// The surface's looks (Brendan, 2026-09-11): the calendar, or what the committees
// have calendared as cards or a table — the listing that was /workspace/calendar-alt.
// The first was called Month until Month became one of the calendar's own
// three views, in the twin of this control beside it (2026-09-21).
type CalendarLook = "month" | "cards" | "table"
const LOOKS: { label: string; value: CalendarLook }[] = [
  { label: "Calendar", value: "month" },
  { label: "Card", value: "cards" },
  { label: "Table", value: "table" },
]

function CalendarWorkspaceInner() {
  const scope = useScope()
  const month = useCalendarTitle()
  const { look: lookParam } = useUrlParams(["look"] as const)
  const look: CalendarLook = lookParam === "table" ? "table" : lookParam === "cards" ? "cards" : "month"
  const setLook = (next: CalendarLook) => writeUrlParams({ look: next === "month" ? null : next }, { history: "push" })
  // Closed on every load; only the footer's hamburger opens it (Brendan, 2026-09-11).
  const [panelOpen, setPanelOpen] = React.useState(false)
  const setFilters = React.useCallback((patch: Partial<Record<ScopeKey, string>>) => writeUrlParams(patch, { history: "push" }), [])
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <ShellFooterProvider footer={<WorkspaceFooter mode="calendar" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)} />}>
              <BlockShell
                defaultOpen={false}
                rail={<CalendarRail />}
                sidebarWidth="250px"
                separatorClassName="mx-1"
                title={<PathBar crumbs={look === "month" ? [APP_CRUMB, { label: "Calendar" }, { label: month }] : [APP_CRUMB, { label: "Calendar" }]} folder onGo={() => {}} />}
                actions={
                  <div className="flex items-center gap-2">
                    {look === "month" && <ViewToggle />}
                    <Segmented label="Look" options={LOOKS} current={look} set={setLook} />
                  </div>
                }
                contentClassName={look === "month" ? "overflow-hidden" : "overflow-y-auto bg-muted dark:bg-background"}
              >
                {look === "month" ? <CalendarPane /> : <CalendarBoard look={look} />}
              </BlockShell>
            </ShellFooterProvider>
          </div>
        </div>
        <div
          aria-hidden={!panelOpen}
          className={cn(
            "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out md:w-(--customizer-width)",
            !panelOpen && "max-md:hidden md:pointer-events-none md:-mr-(--gap) md:w-0! md:opacity-0"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col md:w-(--customizer-width)">
            <CalendarCustomizer filters={scope.filters} setFilters={setFilters} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The customizer's fields carry the designer's lock buttons, which read the locks context.
 *
 * `showpiece` is /calendar (Brendan, 2026-09-21: "a marketing gimmick"): this
 * same calendar with the legislature's schedule and nothing else, where no
 * one adds, moves, edits or deletes an event. On /workspace/calendar a reader
 * does all four once signed in, and none of them before.
 */
export function CalendarWorkspace({ showpiece = false }: { showpiece?: boolean }) {
  const { signedIn } = useAccount()
  return (
    <LocksProvider>
      <CalendarProvider embedded readOnly={showpiece || !signedIn} useSource={showpiece ? usePublicSource : useWorkspaceSource}>
        <CalendarWorkspaceInner />
      </CalendarProvider>
    </LocksProvider>
  )
}
