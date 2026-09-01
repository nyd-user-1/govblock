"use client"

import * as React from "react"

import {
  partyName,
  stateName,
  VOTE_OPTIONS,
  type FilterKey,
  type Filters,
} from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { FieldSeparator } from "@govblock/ui/components/nova/field"
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
} from "@/components/create/picker"

const ALL = "__all__"

export type FilterOption = {
  value: string
  label: string
  hint?: string
  sub?: string
}

// One picker for every filter: the same trigger (label over value) and the
// same menu the design pickers use, so the rail reads as one instrument.
export function FilterPicker({
  label,
  value,
  display,
  options,
  onChange,
  isMobile,
  anchorRef,
  allLabel = "All",
  loading,
}: {
  label: string
  value: string
  display?: string
  options: FilterOption[]
  onChange: (value: string) => void
  isMobile: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
  allLabel?: string | null
  loading?: boolean
}) {
  const current = options.find((option) => option.value === value)
  const shown =
    display ??
    current?.label ??
    (value ? value : loading ? "…" : (allLabel ?? ""))

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="flex min-w-0 flex-col justify-start text-left">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="truncate text-sm font-medium text-foreground">
              {shown}
            </div>
          </div>
        </PickerTrigger>
        <PickerContent
          anchor={isMobile ? anchorRef : undefined}
          side={isMobile ? "top" : "right"}
          align={isMobile ? "center" : "start"}
        >
          <PickerRadioGroup
            value={value || ALL}
            onValueChange={(next) => onChange(next === ALL ? "" : String(next))}
          >
            <PickerGroup>
              {allLabel !== null && (
                <PickerRadioItem value={ALL} closeOnClick>
                  {allLabel}
                </PickerRadioItem>
              )}
              {options.map((option) => (
                <PickerRadioItem
                  key={option.value}
                  value={option.value}
                  closeOnClick
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.sub && (
                      <span className="truncate text-xs font-normal text-neutral-400!">
                        {option.sub}
                      </span>
                    )}
                  </span>
                  {option.hint && (
                    <span className="ml-auto shrink-0 pl-2 text-xs font-normal text-neutral-400! tabular-nums">
                      {option.hint}
                    </span>
                  )}
                </PickerRadioItem>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
    </div>
  )
}

type StateRow = { state: string; bills: number; latest_year: number }
type SessionRow = { session_id: number; bills: number; title: string }
type Option = { value: string; count: number }
type Options = {
  chambers: Option[]
  committees: Option[]
  statuses: Option[]
  parties: Option[]
  subjects: Option[]
}
type MemberRow = {
  people_id: number
  name: string
  party: string
  chamber: string
  district: string
  active: boolean
}
type BillRow = { bill_id: number; bill_number: string; title: string }

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)

function shortSession(title: string) {
  return title
    .replace(/\s*(Regular|General)\s+Session$/i, "")
    .replace(/\s*Session$/i, "")
}

export type SetFilters = (updates: Partial<Record<FilterKey, string>>) => void

// The legislative rail. Each picker narrows the ones below it; changing a
// jurisdiction clears everything that belonged to the old one. /create and
// /typeset both mount it, each with its own search-params model.
export function LegislativeFields({
  filters,
  setFilters,
  isMobile,
  anchorRef,
  children,
}: {
  filters: Filters
  setFilters: SetFilters
  isMobile: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
  children?: React.ReactNode
}) {
  // The header's switcher is the scope; the rail's own State field writes
  // the same place, so the two are one control in two positions.
  const jurisdiction = useJurisdiction()
  const state = filters.state || jurisdiction.state

  const { data: states } = usePolicy<StateRow[]>("states")
  // This picker prints LegiScan's own session titles, so it is one of the two
  // surfaces that pays for them (`?titles=1` — a cold read of "Bills").
  const { data: sessions, isLoading: sessionsLoading } = usePolicy<
    SessionRow[]
  >("sessions", { state }, { titles: 1 })
  const defaultSession =
    state === jurisdiction.state && jurisdiction.session
      ? String(jurisdiction.session)
      : String(
          sessions?.find((row) => Number(row.bills) > 0)?.session_id ??
            sessions?.[0]?.session_id ??
            ""
        )
  const session = filters.session || defaultSession
  const scope: Filters = { state, session }
  const { data: options, isLoading: optionsLoading } = usePolicy<Options>(
    "options",
    scope
  )
  const { data: subjects } = usePolicy<Option[]>("subjects", scope)
  const { data: members, isLoading: membersLoading } = usePolicy<MemberRow[]>(
    "members",
    {
      ...scope,
      chamber: filters.chamber,
      party: filters.party,
    }
  )
  const { bill: _bill, ...billScope } = filters
  const { data: bills, isLoading: billsLoading } = usePolicy<{
    rows: BillRow[]
  }>("bills", { ...billScope, state, session }, { limit: 40 })

  const stateOptions = React.useMemo<FilterOption[]>(
    () =>
      (states ?? []).map((row) => ({
        value: row.state,
        label: stateName(row.state),
        hint: compact(row.bills),
      })),
    [states]
  )
  const sessionOptions = React.useMemo<FilterOption[]>(
    () =>
      (sessions ?? []).map((row) => ({
        value: String(row.session_id),
        label: shortSession(row.title),
        hint: compact(row.bills),
      })),
    [sessions]
  )
  const toOptions = (
    rows: Option[] | undefined,
    labelOf?: (value: string) => string
  ) =>
    (rows ?? []).map((row) => ({
      value: row.value,
      label: labelOf ? labelOf(row.value) : row.value,
      hint: compact(row.count),
    }))
  const memberOptions = React.useMemo<FilterOption[]>(
    () =>
      (members ?? [])
        .filter((m) => m.active || String(m.people_id) === filters.member)
        .map((m) => ({
          value: String(m.people_id),
          label: m.name,
          hint: `${m.party}${m.district ? ` · ${m.district.replace(/^[A-Z]+-0*/, "")}` : ""}`,
        })),
    [members, filters.member]
  )
  const billOptions = React.useMemo<FilterOption[]>(
    () =>
      (bills?.rows ?? []).map((b) => ({
        value: String(b.bill_id),
        label: b.bill_number,
        sub: b.title,
      })),
    [bills]
  )

  const currentMember = members?.find(
    (m) => String(m.people_id) === filters.member
  )
  const currentBill = bills?.rows.find(
    (b) => String(b.bill_id) === filters.bill
  )

  return (
    <>
      <FilterPicker
        label="State"
        value={state}
        display={stateName(state)}
        options={stateOptions}
        allLabel={null}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) =>
          setFilters({
            state: next,
            session: "",
            chamber: "",
            committee: "",
            member: "",
            party: "",
            status: "",
            subject: "",
            vote: "",
            bill: "",
          })
        }
      />
      <FilterPicker
        label="Session"
        value={session}
        display={sessionOptions.find((s) => s.value === session)?.label}
        options={sessionOptions}
        allLabel={null}
        loading={sessionsLoading}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) =>
          setFilters({
            session: next,
            committee: "",
            member: "",
            status: "",
            subject: "",
            bill: "",
          })
        }
      />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker
        label="Chamber"
        value={filters.chamber ?? ""}
        options={toOptions(options?.chambers)}
        loading={optionsLoading}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) => setFilters({ chamber: next, member: "", bill: "" })}
      />
      <FilterPicker
        label="Committee"
        value={filters.committee ?? ""}
        options={toOptions(options?.committees)}
        loading={optionsLoading}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) => setFilters({ committee: next, bill: "" })}
      />
      <FilterPicker
        label="Member"
        value={filters.member ?? ""}
        display={currentMember?.name}
        options={memberOptions}
        loading={membersLoading}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) => setFilters({ member: next, bill: "" })}
      />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker
        label="Party"
        value={filters.party ?? ""}
        options={toOptions(options?.parties, partyName)}
        loading={optionsLoading}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) => setFilters({ party: next, member: "", bill: "" })}
      />
      <FilterPicker
        label="Status"
        value={filters.status ?? ""}
        options={toOptions(options?.statuses)}
        loading={optionsLoading}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) => setFilters({ status: next, bill: "" })}
      />
      {(subjects?.length ?? 0) > 0 && (
        <FilterPicker
          label="Subject"
          value={filters.subject ?? ""}
          options={toOptions(subjects)}
          isMobile={isMobile}
          anchorRef={anchorRef}
          onChange={(next) => setFilters({ subject: next, bill: "" })}
        />
      )}
      <FilterPicker
        label="Votes"
        value={filters.vote ?? ""}
        options={VOTE_OPTIONS.map((v) => ({ value: v.value, label: v.label }))}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) => setFilters({ vote: next, bill: "" })}
      />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker
        label="Bill"
        value={filters.bill ?? ""}
        display={
          currentBill?.bill_number ?? (filters.bill ? undefined : "Latest")
        }
        options={billOptions}
        allLabel="Latest"
        loading={billsLoading}
        isMobile={isMobile}
        anchorRef={anchorRef}
        onChange={(next) => setFilters({ bill: next })}
      />
      {children}
    </>
  )
}
