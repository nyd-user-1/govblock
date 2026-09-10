"use client"

import * as React from "react"
import Link from "next/link"
import {
  CheckIcon,
  Columns2Icon,
  Columns3Icon,
  ListFilterIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { districtLabel, FIPS_TO_STATE, STATE_TO_FIPS } from "@/lib/map/fips"
import type { Representation } from "@/lib/map/join"
import {
  PARTY_COLORS,
  type Acs,
  type DistrictProps,
  type Party,
} from "@/components/map/districts-map"
import type { ChamberDistricts } from "@/components/map/use-state-districts"
import { ChamberSeal } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/nova/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"
import { cn } from "@govblock/ui/lib/utils"

// The right-side panel: a search, then every district as a card (Brendan,
// 2026-09-10). The list of states went — the map is the state picker, and a
// tree of fifty branches was a worse map. What is left answers the two
// questions a reader has: who is this, and where do I live.
//
// The search matches what a reader knows: a member's name, a state, a
// district number, "NY 12". A ZIP or a place name is not in these files, so
// it goes to the Census geocoder and comes back as a point, and the district
// under that point is the one the list scrolls to.

/** What the list can be narrowed to, beside what is typed. */
type Body = "all" | "congress" | "state"
const BODIES: { value: Body; label: string }[] = [
  { value: "all", label: "Every body" },
  { value: "congress", label: "Congress only" },
  { value: "state", label: "State chambers only" },
]
const PARTIES = ["D", "R", "I", "none"] as const

const PARTY_NAME: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
}

/** Anything that is not a name or a number a district file carries. */
const looksGeographic = (q: string) =>
  /^\d{5}(-\d{4})?$/.test(q) || /\d+\s+\w/.test(q) || q.split(/\s+/).length > 2

type Row = {
  key: string
  props: DistrictProps
  /** What the card is titled: "Alabama 2", or a chamber's own name. */
  title: string
  chamber?: string
  seats: { name: string; party: string | null; people_id: number | null }[]
  haystack: string
}

function Card({
  row,
  acs,
  held,
  onClick,
  point,
}: {
  row: Row
  acs: Acs
  held: boolean
  onClick: () => void
  /** The other bodies over the same spot, when the reader asked about a point. */
  point?: Representation | null
}) {
  const code = FIPS_TO_STATE[row.props.state] ?? ""
  const reading = row.chamber ? null : acs[row.props.geoid]
  return (
    <button
      type="button"
      onClick={onClick}
      data-held={held || undefined}
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border bg-muted/40 p-5 text-left transition-colors hover:bg-muted",
        held && "border-foreground/30 bg-muted"
      )}
    >
      <span className="flex items-center gap-2.5">
        {/* The body's own seal, not the state's flag (Brendan, 2026-09-10):
            a congressional district is the U.S. House's, a state district
            its chamber's, and where a chamber has no seal of its own the
            state's great seal stands in — which is what ChamberSeal does. */}
        <ChamberSeal
          state={row.chamber ? code : "US"}
          chamber={row.chamber ?? "House"}
          size={28}
        />
        <span className="text-lg font-semibold tracking-tight">
          {row.title}
        </span>
      </span>

      {row.seats.length ? (
        row.seats.map((seat, i) => (
          <span key={i} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{
                background: PARTY_COLORS[seat.party ?? ""] ?? "#9ca3af",
              }}
            />
            <span className="font-medium">{seat.name}</span>
            <span className="text-sm text-muted-foreground">
              {PARTY_NAME[seat.party ?? ""] ?? seat.party}
            </span>
          </span>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">
          No member on file for this district.
        </span>
      )}

      {reading && (
        <span className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <span className="text-muted-foreground">Population</span>
          <span className="tabular-nums">
            {reading.population != null ? fmtNumber(reading.population) : "—"}
          </span>
          <span className="text-muted-foreground">Median income</span>
          <span className="tabular-nums">
            {reading.medianIncome != null
              ? `$${fmtNumber(reading.medianIncome)}`
              : "—"}
          </span>
        </span>
      )}

      {/* When the reader asked about a spot rather than a district, the same
          spot's other bodies belong on this card, not somewhere else. */}
      {held && point && point.chambers.length > 0 && !row.chamber && (
        <span className="flex flex-col gap-1.5 border-t pt-3 text-sm">
          {point.chambers.map((c) => (
            <span key={c.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-muted-foreground">{c.chamber}</span>
              <span>{c.name}</span>
              {c.seats.map((s, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{
                      background: PARTY_COLORS[s.party ?? ""] ?? "#9ca3af",
                    }}
                  />
                  {s.name}
                </span>
              ))}
            </span>
          ))}
          {point.county && (
            <span className="flex items-baseline gap-2">
              <span className="text-muted-foreground">County</span>
              <span>{point.county.name}</span>
            </span>
          )}
        </span>
      )}

      {code && (
        <Link
          href={`/docs/directory?state=${row.chamber ? code : "US"}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm underline-offset-4 hover:underline"
        >
          Members from {stateName(code)}
        </Link>
      )}
    </button>
  )
}

export function MapPanel({
  open,
  onClose,
  acs,
  party,
  selected,
  states,
  chambers,
  districtsOf,
  onSelectDistrict,
  rep,
  joining,
  onSearch,
}: {
  open: boolean
  onClose: () => void
  acs: Acs
  party: Party
  selected: DistrictProps | null
  /** The FIPS of every jurisdiction with districts, in name order. */
  states: string[]
  chambers: ChamberDistricts[]
  districtsOf: (fips: string) => DistrictProps[]
  onSelectDistrict: (d: DistrictProps | null) => void
  rep: Representation | null
  joining: boolean
  /** A place the files cannot answer: geocoded, then joined. */
  onSearch: (address: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [body, setBody] = React.useState<Body>("all")
  const [parties, setParties] = React.useState<Set<string>>(new Set())
  const filtersOn = body !== "all" || parties.size > 0
  const toggleParty = (p: string) =>
    setParties((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  // Widened only while it is open: a closed panel has no width to widen, so
  // this is read rather than reset when `open` changes.
  const wide = open && expanded

  // Every district that can be shown: Congress always, a state's chambers
  // once their lines are drawn.
  const rows = React.useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const fips of states) {
      const code = FIPS_TO_STATE[fips] ?? ""
      const name = stateName(code)
      for (const d of districtsOf(fips)) {
        const seat = party[d.geoid]
        const seats = seat?.name
          ? [{ name: seat.name, party: seat.party, people_id: seat.people_id }]
          : []
        const title = `${name} ${districtLabel(d.district)}`
        out.push({
          key: `cd-${d.geoid}`,
          props: d,
          title,
          seats,
          haystack:
            `${title} ${code} ${d.district} ${seats.map((s) => s.name).join(" ")}`.toLowerCase(),
        })
      }
    }
    for (const set of chambers) {
      const code = FIPS_TO_STATE[set.fips] ?? ""
      const name = stateName(code)
      for (const d of set.list) {
        const seats = set.members[d.geoid] ?? []
        const title = `${name} ${set.chamber} ${districtLabel(d.district)}`
        out.push({
          key: `${set.id}-${d.geoid}`,
          props: d,
          title,
          chamber: set.chamber,
          seats,
          haystack:
            `${title} ${code} ${d.name} ${seats.map((s) => s.name).join(" ")}`.toLowerCase(),
        })
      }
    }
    return out
  }, [states, districtsOf, party, chambers])

  const q = query.trim().toLowerCase()
  const filtered = React.useMemo(() => {
    const narrow = (list: Row[]) =>
      list.filter((r) => {
        if (body === "congress" && r.chamber) return false
        if (body === "state" && !r.chamber) return false
        if (parties.size) {
          const held = r.seats.map((s) => s.party ?? "none")
          const any = held.length ? held : ["none"]
          if (!any.some((p) => parties.has(p))) return false
        }
        return true
      })
    if (!q) return narrow(rows)
    // "NY 12" and "ny-12" should both find New York's twelfth.
    const parts = q.split(/[\s,-]+/).filter(Boolean)
    const code = parts.find(
      (p) => p.length === 2 && p.toUpperCase() in STATE_TO_FIPS
    )
    const fips = code ? STATE_TO_FIPS[code.toUpperCase()] : null
    return narrow(
      rows.filter((r) => {
        if (fips && r.props.state !== fips) return false
        return parts.every((p) => (p === code ? true : r.haystack.includes(p)))
      })
    )
  }, [rows, q, body, parties])

  const geographic = !!q && filtered.length === 0 && looksGeographic(q)
  const heldKey = selected
    ? `${selected.chamber ? "" : "cd-"}${selected.geoid}`
    : null

  // The card the reader is on scrolls itself into view when the map, not the
  // list, is what chose it.
  const listRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!selected || !listRef.current) return
    const el = listRef.current.querySelector("[data-held]")
    el?.scrollIntoView({ block: "nearest" })
  }, [selected])

  const shown = filtered.slice(0, 250)

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out",
        open
          ? wide
            ? "md:w-[50vw]"
            : "md:w-(--panel-width)"
          : "max-md:hidden md:pointer-events-none md:-mr-(--gap) md:w-0! md:opacity-0"
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card ring ring-foreground/10",
          wide ? "md:w-[50vw]" : "md:w-(--panel-width)"
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b px-5 py-4">
          <span className="min-w-0 flex-1 truncate text-base font-semibold">
            Districts
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            aria-label={wide ? "Shrink panel" : "Expand panel"}
          >
            {wide ? <Columns3Icon /> : <Columns2Icon />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close panel"
          >
            <XIcon />
          </Button>
        </div>

        <form
          className="shrink-0 px-5 pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (geographic) onSearch(query.trim())
          }}
        >
          {/* The two marks sit on the input, not on the form: the form
              carries the panel's padding and centring on it put the glass
              above the field (Brendan, 2026-09-10). */}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="A name, a state, a district, a ZIP"
              className="px-8"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Narrow the list"
                  data-on={filtersOn || undefined}
                  className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[on]:text-foreground data-[state=open]:bg-muted"
                >
                  <ListFilterIcon className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="w-max min-w-44 rounded-lg"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Body
                </DropdownMenuLabel>
                {BODIES.map((b) => (
                  <DropdownMenuItem
                    key={b.value}
                    onClick={() => setBody(b.value)}
                    className="whitespace-nowrap"
                  >
                    {b.label}
                    {body === b.value && (
                      <CheckIcon className="ml-auto size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Party
                </DropdownMenuLabel>
                {PARTIES.map((p) => (
                  <DropdownMenuCheckboxItem
                    key={p}
                    checked={parties.has(p)}
                    onCheckedChange={() => toggleParty(p)}
                    onSelect={(e) => e.preventDefault()}
                    className="whitespace-nowrap"
                  >
                    <span
                      className="mr-1 size-2.5 rounded-full"
                      style={{ background: PARTY_COLORS[p] ?? "#9ca3af" }}
                    />
                    {p === "none" ? "No member" : PARTY_NAME[p]}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!filtersOn}
                  onClick={() => {
                    setBody("all")
                    setParties(new Set())
                  }}
                  className="whitespace-nowrap"
                >
                  Clear
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </form>

        <div
          ref={listRef}
          className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          {joining && (
            <p className="text-sm text-muted-foreground">
              Finding the lines under that point…
            </p>
          )}
          {geographic && !joining && (
            <button
              type="button"
              onClick={() => onSearch(query.trim())}
              className="rounded-xl border border-dashed p-4 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              No district is called that. Press Enter to look up{" "}
              <span className="font-medium text-foreground">
                {query.trim()}
              </span>{" "}
              as a place.
            </button>
          )}
          {!geographic && !shown.length && q && (
            <p className="text-sm text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </p>
          )}
          {shown.map((row) => (
            <Card
              key={row.key}
              row={row}
              acs={acs}
              held={heldKey === row.key}
              point={rep}
              onClick={() =>
                onSelectDistrict(heldKey === row.key ? null : row.props)
              }
            />
          ))}
          {filtered.length > shown.length && (
            <p className="text-sm text-muted-foreground">
              {fmtNumber(filtered.length - shown.length)} more. Narrow the
              search to see them.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
