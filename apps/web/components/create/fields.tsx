"use client"

import * as React from "react"
import { ArrowHorizontalIcon, ParagraphSpacingIcon, TextSmallcapsIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { DESIGN_LABEL, DESIGN_OPTIONS, type Design, type DesignKey } from "@/lib/create/preset"
import { partyName, stateName, VOTE_OPTIONS } from "@/lib/filters"
import { fmtCompact } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { billFilters, type ScopeFilters, type ScopeKey } from "@/lib/policy/scope"
import { usePolicy, useSnapshot } from "@/lib/policy/use-policy"
import { FilterPicker, type Option } from "@/components/create/filter-picker"
import { FieldSeparator } from "@govblock/ui/components/nova/field"

// ── State: the legislative rail ────────────────────────────────────────────
//
// Each picker narrows the ones below it; changing a jurisdiction clears
// everything that belonged to the old one. The options come from the same
// reads /typeset's rail makes, so the two rails agree on what exists.
//
// Three pickers are new on 2026-09-03: Topics (LegiScan's subjects), Departments
// (who issues the thing — the legislature for bills, the executive for
// nominations, the FEC for filings, an agency for a form) and FEC (the election
// cycle the finance block reads). Forms admits the forms list's own cut:
// forms alone, every document, or the fillable ones.

type StateRow = { state: string; bills: number; latest_year: number }
type SessionRow = { session_id: number; bills: number; title: string }
type Count = { value: string; count: number }
type Options = { chambers: Count[]; committees: Count[]; statuses: Count[]; parties: Count[]; subjects: Count[] }
type MemberRow = { people_id: number; name: string; party: string; chamber: string; district: string; active: boolean }
type BillRow = { bill_id: number; bill_number: string; title: string }
type FormsFacets = { facets?: { agency?: Count[] }; empty?: string }
type FecManifest = { cycles: { cycle: number; rows: number }[] }

export type SetFilters = (patch: Partial<Record<ScopeKey, string>>) => void

// The departments that are not agencies: every bill is the legislature's, every
// nomination the executive's, every filing the FEC's. An agency code from the
// forms table joins them below when the scope holds forms.
export const DEPARTMENTS: Option[] = [
  { value: "legislature", label: "Legislature", sub: "Bills, laws, reports, the Record" },
  { value: "executive", label: "Executive", sub: "Nominations" },
  { value: "fec", label: "FEC", sub: "Campaign finance" },
]

export const FORMS_OPTIONS: Option[] = [
  { value: "forms", label: "Forms" },
  { value: "fillable", label: "Fillable forms" },
  { value: "all", label: "All documents" },
]

const shortSession = (title: string) => title.replace(/\s*(Regular|General)\s+Session$/i, "").replace(/\s*Session$/i, "")
const compact = (value: number | null | undefined) => (value == null ? undefined : fmtCompact(value, false))

export function LegislativeFields({ filters, setFilters, isMobile, anchorRef }: { filters: ScopeFilters; setFilters: SetFilters; isMobile?: boolean; anchorRef?: React.RefObject<HTMLDivElement | null> }) {
  // The header's switcher is the scope; the rail's own State field writes the
  // same place, so the two are one control in two positions.
  const jurisdiction = useJurisdiction()
  const state = filters.state || jurisdiction.state
  const { data: states } = usePolicy<StateRow[]>("states")
  const { data: sessions, isLoading: sessionsLoading } = usePolicy<SessionRow[]>("sessions", { state }, { titles: 1 })
  const defaultSession = state === jurisdiction.state && jurisdiction.session ? String(jurisdiction.session) : String(sessions?.find((row) => Number(row.bills) > 0)?.session_id ?? sessions?.[0]?.session_id ?? "")
  const session = filters.session || defaultSession
  const scope = { state, session }
  const { data: options, isLoading: optionsLoading } = usePolicy<Options>("options", scope)
  const { data: subjects } = usePolicy<Count[]>("subjects", scope)
  const { data: members, isLoading: membersLoading } = usePolicy<MemberRow[]>("members", { ...scope, chamber: filters.chamber, party: filters.party })
  const { data: bills, isLoading: billsLoading } = usePolicy<{ rows: BillRow[] }>("bills", { ...billFilters(filters), state, session }, { limit: 40 })
  const { data: formsFacets } = useSnapshot<FormsFacets>(`/api/policy/forms?state=${state}&limit=1${filters.forms === "all" ? "&all=1" : ""}`)
  const { data: manifest } = useSnapshot<FecManifest>("/api/fec/manifest")

  const toOptions = (rows: Count[] | undefined, labelOf?: (value: string) => string): Option[] => (rows ?? []).map((row) => ({ value: row.value, label: labelOf ? labelOf(row.value) : row.value, hint: compact(row.count) }))
  const stateOptions = React.useMemo<Option[]>(() => (states ?? []).map((row) => ({ value: row.state, label: stateName(row.state), hint: compact(row.bills) })), [states])
  const sessionOptions = React.useMemo<Option[]>(() => (sessions ?? []).map((row) => ({ value: String(row.session_id), label: shortSession(row.title), hint: compact(row.bills) })), [sessions])
  const memberOptions = React.useMemo<Option[]>(
    () =>
      (members ?? [])
        .filter((m) => m.active || String(m.people_id) === filters.member)
        .map((m) => ({ value: String(m.people_id), label: m.name, hint: `${m.party}${m.district ? ` · ${m.district.replace(/^[A-Z]+-0*/, "")}` : ""}` })),
    [members, filters.member]
  )
  const billOptions = React.useMemo<Option[]>(() => (bills?.rows ?? []).map((b) => ({ value: String(b.bill_id), label: b.bill_number, sub: b.title })), [bills])
  const departmentOptions = React.useMemo<Option[]>(
    () => [...DEPARTMENTS, ...(formsFacets?.facets?.agency ?? []).map((row) => ({ value: row.value, label: row.value, hint: compact(row.count), sub: "Forms" }))],
    [formsFacets]
  )
  const cycleOptions = React.useMemo<Option[]>(() => (manifest?.cycles ?? []).map((row) => ({ value: String(row.cycle), label: `${row.cycle - 1}–${row.cycle}`, hint: compact(row.rows) })), [manifest])

  const currentMember = members?.find((m) => String(m.people_id) === filters.member)
  const currentBill = bills?.rows.find((b) => String(b.bill_id) === filters.bill)
  const pick = { isMobile, anchorRef }

  return (
    <>
      <FilterPicker
        label="State"
        param="state"
        value={state}
        display={stateName(state)}
        options={stateOptions}
        allLabel={null}
        {...pick}
        onChange={(next) => setFilters({ state: next, session: "", chamber: "", committee: "", member: "", party: "", status: "", subject: "", vote: "", bill: "", department: "" })}
      />
      <FilterPicker
        label="Session"
        param="session"
        value={session}
        display={sessionOptions.find((s) => s.value === session)?.label}
        options={sessionOptions}
        allLabel={null}
        loading={sessionsLoading}
        {...pick}
        onChange={(next) => setFilters({ session: next, committee: "", member: "", status: "", subject: "", bill: "" })}
      />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Chamber" param="chamber" value={filters.chamber ?? ""} options={toOptions(options?.chambers)} loading={optionsLoading} {...pick} onChange={(next) => setFilters({ chamber: next, member: "", bill: "" })} />
      <FilterPicker label="Committee" param="committee" value={filters.committee ?? ""} options={toOptions(options?.committees)} loading={optionsLoading} {...pick} onChange={(next) => setFilters({ committee: next, bill: "" })} />
      <FilterPicker label="Member" param="member" value={filters.member ?? ""} display={currentMember?.name} options={memberOptions} loading={membersLoading} {...pick} onChange={(next) => setFilters({ member: next, bill: "" })} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Party" param="party" value={filters.party ?? ""} options={toOptions(options?.parties, partyName)} loading={optionsLoading} {...pick} onChange={(next) => setFilters({ party: next, member: "", bill: "" })} />
      <FilterPicker label="Status" param="status" value={filters.status ?? ""} options={toOptions(options?.statuses)} loading={optionsLoading} {...pick} onChange={(next) => setFilters({ status: next, bill: "" })} />
      <FilterPicker label="Topics" param="subject" value={filters.subject ?? ""} options={toOptions(subjects)} loading={!subjects} {...pick} onChange={(next) => setFilters({ subject: next, bill: "" })} />
      <FilterPicker label="Votes" param="vote" value={filters.vote ?? ""} options={VOTE_OPTIONS.map((v) => ({ value: v.value, label: v.label }))} {...pick} onChange={(next) => setFilters({ vote: next, bill: "" })} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Department" param="department" value={filters.department ?? ""} options={departmentOptions} {...pick} onChange={(next) => setFilters({ department: next })} />
      <FilterPicker label="FEC" param="cycle" value={filters.cycle ?? ""} display={filters.cycle ? undefined : "Latest cycle"} options={cycleOptions} allLabel="Latest cycle" {...pick} onChange={(next) => setFilters({ cycle: next })} />
      <FilterPicker label="Forms" param="forms" value={filters.forms ?? ""} display={filters.forms ? undefined : "Forms"} options={FORMS_OPTIONS} allLabel="Forms" {...pick} onChange={(next) => setFilters({ forms: next === "forms" ? "" : next })} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Bill" param="bill" value={filters.bill ?? ""} display={currentBill?.bill_number ?? (filters.bill ? undefined : "Latest")} options={billOptions} allLabel="Latest" loading={billsLoading} {...pick} onChange={(next) => setFilters({ bill: next })} />
    </>
  )
}

// ── Design: the preset ─────────────────────────────────────────────────────

const SWATCH: Record<string, string> = { neutral: "bg-neutral-500", zinc: "bg-zinc-500", stone: "bg-stone-500", mauve: "bg-purple-300", olive: "bg-lime-700", mist: "bg-sky-300", taupe: "bg-stone-400", blue: "bg-blue-600", green: "bg-green-600", orange: "bg-orange-500", red: "bg-red-600", rose: "bg-rose-500", violet: "bg-violet-600", yellow: "bg-yellow-500" }
const Dot = ({ value }: { value: string }) => <span className={`inline-block size-3.5 rounded-full ${SWATCH[value] ?? "bg-neutral-500"}`} />
const Aa = () => <span className="text-xs font-medium text-foreground">Aa</span>
const Glyph = ({ icon }: { icon: IconSvgElement }) => <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4.5 text-foreground" />

// typeset's leading glyph: two rules with an A between them.
const LineHeightIcon: IconSvgElement = [
  ["path", { d: "M4.5 3.5H19.5", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "0" }],
  ["path", { d: "M4.5 20.5H19.5", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "1" }],
  ["path", { d: "M17 17L14.8905 11.4741C13.9109 8.90801 13.4211 7.625 12.625 7.625C11.8289 7.625 11.3391 8.90801 10.3595 11.4741L8.25 17", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "2" }],
  ["path", { d: "M9.5 14H15.5", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "3" }],
]

const TRAILING: Record<DesignKey, React.ReactNode | ((value: string) => React.ReactNode)> = {
  style: <span className="inline-block size-3.5 rounded-[5px] border border-current text-foreground" />,
  base: (value) => <Dot value={value} />,
  theme: (value) => <Dot value={value} />,
  chart: (value) => <Dot value={value} />,
  heading: <Aa />,
  body: <Aa />,
  mono: <Aa />,
  measure: <Glyph icon={ArrowHorizontalIcon} />,
  scale: <Glyph icon={TextSmallcapsIcon} />,
  leading: <Glyph icon={LineHeightIcon} />,
  flow: <Glyph icon={ParagraphSpacingIcon} />,
  icons: <span className="text-xs text-foreground">◎</span>,
  radius: <span className="inline-block size-3 rounded-tr-lg border-t-2 border-r-2 border-current text-foreground" />,
}

const GROUPS: DesignKey[][] = [["style"], ["base", "theme", "chart"], ["heading", "body", "mono"], ["measure", "scale", "leading", "flow"], ["icons", "radius"]]

export function DesignFields({ design, set, isMobile, anchorRef }: { design: Design; set: (patch: Partial<Design>) => void; isMobile?: boolean; anchorRef?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <>
      {GROUPS.map((group, index) => (
        <React.Fragment key={group.join("-")}>
          {index > 0 && <FieldSeparator className="hidden md:block" />}
          {group.map((key) => {
            const trailing = TRAILING[key]
            return (
              <FilterPicker
                key={key}
                label={DESIGN_LABEL[key]}
                param={key}
                value={design[key]}
                options={DESIGN_OPTIONS[key]}
                allLabel={null}
                isMobile={isMobile}
                anchorRef={anchorRef}
                // Below ~60ch the viewport already constrains width, so measure does nothing.
                className={key === "measure" ? "max-[28rem]:hidden" : undefined}
                onChange={(value) => set({ [key]: value })}
                trailing={typeof trailing === "function" ? trailing(design[key]) : trailing}
              />
            )
          })}
        </React.Fragment>
      ))}
    </>
  )
}
