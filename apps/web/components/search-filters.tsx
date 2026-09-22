"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { ArrowRight, ChevronDown, Lock, Search } from "lucide-react"

import { partyName, stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { FlagChip } from "@/components/policy/imagery"
import { SEARCH_SECTION_ID, goToSection } from "@/components/root-sections"
import { cn } from "@govblock/ui/lib/utils"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@govblock/ui/components/nova/command"
import { Kbd } from "@govblock/ui/components/nova/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"

// The filter panel in the search's right rail (Brendan, 2026-09-05: "a real
// filter panel"). Every control narrows the results on the page, and the
// choices live in the URL beside the query, so a filtered search is a link.
//
// Drawn in the rail's own vocabulary (Brendan, 2026-09-22): it wore the Field
// component's bordered, tinted cards, which no other rail on the site draws.
//
// Every group is a menu (Brendan, the same day: "let's make them a drop down
// multi-select so you can see it all"). Open, a jurisdiction search was 52
// rows long and the panel ran past the rail's foot with the groups under it
// out of sight; closed into a line each, the whole panel is in view at once
// and a group opens over the page when it is wanted. The menu is the site's
// own — the jurisdiction switcher's popover and command list, searchable the
// way that one is — and inside it the rows are the rail's: a strip that
// lights on hover, the count at the right in tabular figures, and the jump
// arrow held back until the row is pointed at.
//
// What it filters on (Brendan, the same day: "feels like we're leaving out
// some things that would make for a better search"). Jurisdiction leads,
// because a search spanning 52 of them is the first thing worth cutting, and
// it is a list of the jurisdictions actually found rather than the toggle
// between "every" and "here" that threw that away. Under it: the sections,
// the age of the latest action, the committee a bill sits in, a member's
// party and whether they are still serving, the chamber, and the status.
// Every one reads a column the results already carry.
//
// Session is the exception: drawn and locked. The search reads each
// jurisdiction's current session and nothing earlier, so the control shows
// what a plan would open rather than pretending to work.

export type SearchFilterState = {
  /** The sections shown; empty means all. */
  show: string[]
  /** The jurisdictions kept, by code; empty means every one found. */
  places: string[]
  /** How old the latest action may be: "" any time, else a week, a month, a year. */
  since: "" | "week" | "month" | "year"
  /** The committees kept; empty means all. */
  committees: string[]
  /** The parties kept, by code; empty means all. */
  parties: string[]
  /** "" either, "yes" still serving, "no" no longer. */
  serving: "" | "yes" | "no"
  chamber: string
  status: string[]
}

/** Committees and topics came out of the results on 2026-09-22, so they are no longer a thing to show or hide. */
export const SECTIONS: { key: string; label: string }[] = [
  { key: "bills", label: "Bills" },
  { key: "texts", label: "Text" },
  { key: "laws", label: "Laws" },
  { key: "members", label: "Members" },
  { key: "pages", label: "Pages" },
]

/** The windows the recency filter offers, and how far back each reaches. */
export const SINCE: { value: SearchFilterState["since"]; label: string; days: number }[] = [
  { value: "", label: "Any time", days: 0 },
  { value: "week", label: "Past week", days: 7 },
  { value: "month", label: "Past month", days: 31 },
  { value: "year", label: "Past year", days: 365 },
]

/** The day a window begins, written as the rows' dates are; "" for any time. */
export function sinceDate(since: SearchFilterState["since"]): string {
  const days = SINCE.find((s) => s.value === since)?.days ?? 0
  if (!days) return ""
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export const EMPTY_FILTERS: SearchFilterState = { show: [], places: [], since: "", committees: [], parties: [], serving: "", chamber: "", status: [] }

/** The id the search hangs on a section, and the rail jumps to. */
export const sectionId = (key: string) => `results-${key}`

export function readFilters(params: URLSearchParams): SearchFilterState {
  const list = (key: string) => (params.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  const since = params.get("since")
  const serving = params.get("serving")
  return {
    show: list("show"),
    places: list("places").map((p) => p.toUpperCase()),
    since: since === "week" || since === "month" || since === "year" ? since : "",
    committees: list("committee"),
    parties: list("party").map((p) => p.toUpperCase()),
    serving: serving === "yes" || serving === "no" ? serving : "",
    chamber: params.get("chamber") ?? "",
    status: list("status"),
  }
}

export function writeFilters(params: URLSearchParams, filters: SearchFilterState) {
  const set = (key: string, value: string) => (value ? params.set(key, value) : params.delete(key))
  set("show", filters.show.join(","))
  set("places", filters.places.join(","))
  set("since", filters.since)
  set("committee", filters.committees.join(","))
  set("party", filters.parties.join(","))
  set("serving", filters.serving)
  set("chamber", filters.chamber)
  set("status", filters.status.join(","))
  // The toggle these replaced (2026-09-22); an old link still opens, unfiltered.
  params.delete("scope")
  return params
}

export function isFiltered(filters: SearchFilterState) {
  return (
    filters.show.length > 0 ||
    filters.places.length > 0 ||
    !!filters.since ||
    filters.committees.length > 0 ||
    filters.parties.length > 0 ||
    !!filters.serving ||
    !!filters.chamber ||
    filters.status.length > 0
  )
}

/** A row inside a menu: the control, the label, its count, and the arrow where the row leads somewhere. */
function Row({ label, count, checked, onToggle, onJump, media, radio = false }: { label: string; count?: number; checked: boolean; onToggle: () => void; onJump?: () => void; /** A flag before the label: the jurisdiction rows. */ media?: React.ReactNode; /** One of the group rather than some of it: a mark where the box would be. */ radio?: boolean }) {
  return (
    <CommandItem value={label} onSelect={onToggle} className="group/row gap-2.5">
      {radio ? (
        <span className={cn("flex size-3.5 shrink-0 items-center justify-center rounded-full border", checked ? "border-[4px] border-primary" : "border-input")} aria-hidden />
      ) : (
        <Checkbox checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none size-3.5 shrink-0 rounded-[4px]" />
      )}
      {media}
      <span className={cn("min-w-0 flex-1 truncate text-[0.8rem]", checked ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      {count != null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtNumber(count)}</span>}
      {onJump && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onJump()
          }}
          disabled={!count}
          aria-label={`Go to ${label}`}
          className="-mr-1 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0 group-hover/row:opacity-100"
        >
          {/* Right, until it is pointed at: then it turns up and out, which is the arrow the record items already use. */}
          <ArrowRight className="size-3.5 transition-transform duration-200 hover:-rotate-45 motion-reduce:transition-none" />
        </button>
      )}
    </CommandItem>
  )
}

/** The line a closed group stands as: its name, what it is narrowed to, and the chevron. */
const TRIGGER = "flex h-8 w-full items-center gap-2 rounded-lg border bg-background px-2.5 text-[0.8rem] transition-colors hover:bg-muted data-[popup-open]:bg-muted"

function Group({ title, summary, muted, children, media, disabled = false }: { title: string; summary: string; /** The summary is the untouched one: "All", "Any time". */ muted: boolean; children?: React.ReactNode; media?: React.ReactNode; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const line = (
    <>
      {media}
      <span className={cn("min-w-0 flex-1 truncate text-left", muted ? "text-muted-foreground" : "text-foreground")}>{summary}</span>
      {disabled ? <Lock className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
    </>
  )
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {disabled ? (
        <div className={cn(TRIGGER, "cursor-not-allowed opacity-60")}>{line}</div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<button type="button" aria-label={`${title}: ${summary}`} className={TRIGGER} />}>{line}</PopoverTrigger>
          <PopoverContent align="end" sideOffset={4} className="w-[17rem] p-0" aria-label={title}>
            {children}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

/** The menu inside a group: the rows, searchable where there are enough of them to need it. */
function Menu({ search, footer, children }: { search?: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Command loop className="rounded-lg!">
      {search && <CommandInput placeholder={search} autoFocus />}
      <CommandList className="max-h-[min(22rem,60svh)] pt-1.5">
        <CommandEmpty>Nothing to narrow by.</CommandEmpty>
        {children}
      </CommandList>
      {footer}
    </Command>
  )
}

/** All / None, under a menu that takes more than one. */
function Both({ onAll, onNone }: { onAll: () => void; onNone: () => void }) {
  return (
    <div className="flex items-center gap-1 border-t p-1">
      <button type="button" onClick={onAll} className="flex-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        All
      </button>
      <button type="button" onClick={onNone} className="flex-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        None
      </button>
    </div>
  )
}

/** What a closed multi-select says: every one of them, or the one chosen, or how many of how many. */
function summarize(selected: string[], options: { value: string; label: string }[], all = "All") {
  if (!selected.length || selected.length === options.length) return all
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? selected[0]
  return `${selected.length} of ${options.length}`
}

/**
 * The way back to the search from a rail open beside something else (Brendan,
 * 2026-09-22: "otherwise the filter panel is open out of place next to
 * anything"). The site's quick-search field, as a button: it goes to the root's
 * search section, where the bar these filters serve lives.
 */
function GlobalSearch() {
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  return (
    <button
      type="button"
      onClick={() => (pathname === "/" ? goToSection(SEARCH_SECTION_ID) : router.push(`/#${SEARCH_SECTION_ID}`))}
      className="flex h-8 w-full items-center gap-2 rounded-lg border bg-background px-2.5 text-[0.8rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Search className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">Global search&hellip;</span>
      <Kbd className="border bg-background">⌘K</Kbd>
    </button>
  )
}

export function SearchFilters({
  filters,
  onChange,
  here,
  counts,
  places,
  committees,
  parties,
  serving,
  chambers,
  statuses,
  sessions = [],
}: {
  filters: SearchFilterState
  onChange: (next: SearchFilterState) => void
  /** The jurisdiction in scope, for the line that stands where a filter would. */
  here: string
  /** Rows per section, before the filters. */
  counts: Record<string, number>
  /** What the results carry, each with its count, before the filters. */
  places: { value: string; count: number }[]
  committees: { value: string; count: number }[]
  parties: { value: string; count: number }[]
  serving: { yes: number; no: number }
  chambers: { value: string; count: number }[]
  statuses: { value: string; count: number }[]
  /** The sessions a plan would open; drawn locked. */
  sessions?: string[]
}) {
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const showing = (key: string) => filters.show.length === 0 || filters.show.includes(key)
  /** A list where empty means all: ticking the last one back empties it again. */
  const pick = (current: string[], every: string[], value: string) => {
    const next = toggle(current.length ? current : every, value)
    return next.length === every.length ? [] : next
  }
  const sectionKeys = SECTIONS.map((s) => s.key)

  // Jumping to a section the reader has hidden means showing it again — the
  // ask was to go there, and there is nothing there to go to otherwise. The
  // scroll waits a frame for that section to render.
  const jump = (key: string) => {
    if (!showing(key)) onChange({ ...filters, show: pick(filters.show, sectionKeys, key) })
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    requestAnimationFrame(() =>
      document.getElementById(sectionId(key))?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" })
    )
  }

  const placeName = (code: string) => (code === "US" ? "U.S. Congress" : stateName(code) || code)
  const placeOptions = places.map((p) => ({ value: p.value, label: placeName(p.value) }))
  const sectionOptions = SECTIONS.map((s) => ({ value: s.key, label: s.label }))
  const committeeOptions = committees.map((c) => ({ value: c.value, label: c.value }))
  const statusOptions = statuses.map((s) => ({ value: s.value, label: s.value }))
  const partyOptions = parties.map((p) => ({ value: p.value, label: partyName(p.value) || p.value }))
  const chosenPlaces = filters.places.length ? filters.places : placeOptions.map((p) => p.value)

  return (
    <div className="flex flex-col gap-3 p-4 pt-0 text-sm">
      <GlobalSearch />

      <div className="flex h-6 items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Filters</p>
        {isFiltered(filters) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="-mr-2 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* First, because a search spanning 52 jurisdictions is the first thing worth cutting — and searchable, since it can be all 52. */}
      {places.length > 1 && (
        <Group
          title="Jurisdiction"
          summary={summarize(filters.places, placeOptions, "Every jurisdiction")}
          muted={!filters.places.length}
          media={filters.places.length === 1 ? <FlagChip state={filters.places[0]} width={16} /> : undefined}
        >
          <Menu
            search="Search jurisdictions…"
            footer={<Both onAll={() => onChange({ ...filters, places: [] })} onNone={() => onChange({ ...filters, places: [places[0].value] })} />}
          >
            {places.map((place) => (
              <Row
                key={place.value}
                label={placeName(place.value)}
                count={place.count}
                media={<FlagChip state={place.value} width={16} />}
                checked={chosenPlaces.includes(place.value)}
                onToggle={() => onChange({ ...filters, places: pick(filters.places, placeOptions.map((p) => p.value), place.value) })}
              />
            ))}
          </Menu>
        </Group>
      )}

      <Group title="Show" summary={summarize(filters.show, sectionOptions)} muted={!filters.show.length}>
        <Menu footer={<Both onAll={() => onChange({ ...filters, show: [] })} onNone={() => onChange({ ...filters, show: [sectionKeys[0]] })} />}>
          {SECTIONS.map((section) => (
            <Row
              key={section.key}
              label={section.label}
              count={counts[section.key]}
              checked={showing(section.key)}
              onJump={() => jump(section.key)}
              onToggle={() => onChange({ ...filters, show: pick(filters.show, sectionKeys, section.key) })}
            />
          ))}
        </Menu>
      </Group>

      {/* The latest action's age. Bills and their text carry the date; laws, members and committees do not, so it leaves them alone. */}
      <Group title="Last action" summary={SINCE.find((s) => s.value === filters.since)?.label ?? "Any time"} muted={!filters.since}>
        <Menu>
          {SINCE.map((option) => (
            <Row key={option.value || "any"} label={option.label} radio checked={filters.since === option.value} onToggle={() => onChange({ ...filters, since: option.value })} />
          ))}
        </Menu>
      </Group>

      {committees.length > 1 && (
        <Group title="Committee" summary={summarize(filters.committees, committeeOptions)} muted={!filters.committees.length}>
          <Menu
            search="Search committees…"
            footer={<Both onAll={() => onChange({ ...filters, committees: [] })} onNone={() => onChange({ ...filters, committees: [committees[0].value] })} />}
          >
            {committees.map((committee) => (
              <Row
                key={committee.value}
                label={committee.value}
                count={committee.count}
                checked={filters.committees.length === 0 || filters.committees.includes(committee.value)}
                onToggle={() => onChange({ ...filters, committees: pick(filters.committees, committeeOptions.map((c) => c.value), committee.value) })}
              />
            ))}
          </Menu>
        </Group>
      )}

      {chambers.length > 1 && (
        <Group title="Chamber" summary={filters.chamber || "Any chamber"} muted={!filters.chamber}>
          <Menu>
            <Row label="Any chamber" radio count={chambers.reduce((sum, c) => sum + c.count, 0)} checked={!filters.chamber} onToggle={() => onChange({ ...filters, chamber: "" })} />
            {chambers.map((chamber) => (
              <Row key={chamber.value} label={chamber.value} radio count={chamber.count} checked={filters.chamber === chamber.value} onToggle={() => onChange({ ...filters, chamber: chamber.value })} />
            ))}
          </Menu>
        </Group>
      )}

      {statuses.length > 1 && (
        <Group title="Status" summary={summarize(filters.status, statusOptions)} muted={!filters.status.length}>
          <Menu
            search={statuses.length > 8 ? "Search statuses…" : undefined}
            footer={<Both onAll={() => onChange({ ...filters, status: [] })} onNone={() => onChange({ ...filters, status: [statuses[0].value] })} />}
          >
            {statuses.map((status) => (
              <Row
                key={status.value}
                label={status.value}
                count={status.count}
                checked={filters.status.length === 0 || filters.status.includes(status.value)}
                onToggle={() => onChange({ ...filters, status: pick(filters.status, statusOptions.map((s) => s.value), status.value) })}
              />
            ))}
          </Menu>
        </Group>
      )}

      {parties.length > 1 && (
        <Group title="Party" summary={summarize(filters.parties, partyOptions)} muted={!filters.parties.length}>
          <Menu footer={<Both onAll={() => onChange({ ...filters, parties: [] })} onNone={() => onChange({ ...filters, parties: [parties[0].value] })} />}>
            {parties.map((party) => (
              <Row
                key={party.value}
                label={partyName(party.value) || party.value}
                count={party.count}
                checked={filters.parties.length === 0 || filters.parties.includes(party.value)}
                onToggle={() => onChange({ ...filters, parties: pick(filters.parties, partyOptions.map((p) => p.value), party.value) })}
              />
            ))}
          </Menu>
        </Group>
      )}

      {serving.no > 0 && (
        <Group title="Members" summary={filters.serving === "yes" ? "Still serving" : filters.serving === "no" ? "No longer serving" : "Serving or not"} muted={!filters.serving}>
          <Menu>
            <Row label="Serving or not" radio checked={!filters.serving} onToggle={() => onChange({ ...filters, serving: "" })} />
            <Row label="Still serving" radio count={serving.yes} checked={filters.serving === "yes"} onToggle={() => onChange({ ...filters, serving: "yes" })} />
            <Row label="No longer serving" radio count={serving.no} checked={filters.serving === "no"} onToggle={() => onChange({ ...filters, serving: "no" })} />
          </Menu>
        </Group>
      )}

      {/* Drawn, locked, and honest about it: the search reads each jurisdiction's current session and nothing earlier. */}
      <div className="flex flex-col gap-1">
        <Group title="Session" summary={`Current session${sessions.length ? "" : ""}`} muted={false} disabled />
        <Link href="/pricing" className="text-[0.75rem] text-primary no-underline hover:underline">
          Search earlier sessions with a plan
        </Link>
      </div>

      {!places.length && !counts.bills && (
        <p className="text-[0.75rem] text-muted-foreground">Search to filter. {stateName(here) || here} leads the results; the rest follow.</p>
      )}
    </div>
  )
}
