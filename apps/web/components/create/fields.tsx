"use client"

import { PARTY_LABEL, stateName } from "@/lib/filters"
import { fmtCompact } from "@/lib/format"
import type { StateCount } from "@/lib/policy/states"
import { FilterPicker, type Option } from "@/components/create/filter-picker"
import { FieldSeparator } from "@govblock/ui/components/nova/field"

// ── State: the legislative filters ─────────────────────────────────────────

export type Filters = { state: string; session: string; chamber: string; committee: string; member: string; party: string; status: string; vote: string }

export const EMPTY_FILTERS: Filters = { state: "US", session: "", chamber: "", committee: "", member: "", party: "", status: "", vote: "" }

export function LegislativeFields({
  filters,
  set,
  states,
  chambers,
  committees,
  members,
  statuses,
}: {
  filters: Filters
  set: (patch: Partial<Filters>) => void
  states: StateCount[]
  chambers: string[]
  committees: string[]
  members: string[]
  statuses: string[]
}) {
  const stateOptions: Option[] = states.map((s) => ({ value: s.state, label: s.name, hint: s.bills != null ? fmtCompact(s.bills, false) : undefined }))
  const current = states.find((s) => s.state === filters.state)
  const sessionOptions: Option[] = current?.session ? [{ value: String(current.session), label: filters.state === "US" ? `${current.session}-${current.session + 1}` : String(current.session) }] : []
  const opts = (xs: string[]): Option[] => xs.map((x) => ({ value: x, label: x }))
  return (
    <>
      <FilterPicker label="State" value={filters.state} options={stateOptions} allLabel={null} onChange={(state) => set({ state, session: "", chamber: "", committee: "", member: "" })} />
      <FilterPicker label="Session" value={filters.session || (sessionOptions[0]?.value ?? "")} options={sessionOptions} allLabel={null} onChange={(session) => set({ session })} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Chamber" value={filters.chamber} options={opts(chambers)} onChange={(chamber) => set({ chamber })} />
      <FilterPicker label="Committee" value={filters.committee} options={opts(committees)} onChange={(committee) => set({ committee })} />
      <FilterPicker label="Member" value={filters.member} options={opts(members)} onChange={(member) => set({ member })} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Party" value={filters.party} options={Object.entries(PARTY_LABEL).slice(0, 3).map(([value, label]) => ({ value, label }))} onChange={(party) => set({ party })} />
      <FilterPicker label="Status" value={filters.status} options={opts(statuses)} onChange={(status) => set({ status })} />
      <FilterPicker label="Votes" value={filters.vote} options={[{ value: "Yea", label: "Aye" }, { value: "Nay", label: "Nay" }, { value: "NV", label: "No Vote" }, { value: "Absent", label: "Absent" }]} onChange={(vote) => set({ vote })} />
      <span className="sr-only">{stateName(filters.state)}</span>
    </>
  )
}

// ── Design: the preset ─────────────────────────────────────────────────────

export type Design = { style: string; baseColor: string; theme: string; chartColor: string; fontHeading: string; font: string; iconLibrary: string; radius: string }

export const DEFAULT_DESIGN: Design = { style: "luma", baseColor: "neutral", theme: "blue", chartColor: "red", fontHeading: "inherit", font: "inter", iconLibrary: "lucide", radius: "medium" }

export const DESIGN_OPTIONS: Record<keyof Design, Option[]> = {
  style: ["nova", "luma", "vega", "lyra", "maia", "mira", "sera", "rhea"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
  baseColor: ["neutral", "zinc", "stone", "mauve", "olive", "mist", "taupe"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
  theme: ["neutral", "blue", "green", "orange", "red", "rose", "violet", "yellow"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
  chartColor: ["neutral", "blue", "green", "orange", "red", "violet"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
  fontHeading: [{ value: "inherit", label: "Inherit" }, { value: "geist", label: "Geist" }, { value: "inter", label: "Inter" }, { value: "manrope", label: "Manrope" }],
  font: [{ value: "inter", label: "Inter" }, { value: "geist", label: "Geist" }, { value: "manrope", label: "Manrope" }, { value: "figtree", label: "Figtree" }],
  iconLibrary: [{ value: "lucide", label: "Lucide" }, { value: "tabler", label: "Tabler" }, { value: "hugeicons", label: "Hugeicons" }, { value: "phosphor", label: "Phosphor" }],
  radius: [{ value: "none", label: "None" }, { value: "small", label: "Small" }, { value: "medium", label: "Default" }, { value: "large", label: "Large" }],
}

const SWATCH: Record<string, string> = { neutral: "bg-neutral-500", zinc: "bg-zinc-500", stone: "bg-stone-500", mauve: "bg-purple-300", olive: "bg-lime-700", mist: "bg-sky-300", taupe: "bg-stone-400", blue: "bg-blue-600", green: "bg-green-600", orange: "bg-orange-500", red: "bg-red-600", rose: "bg-rose-500", violet: "bg-violet-600", yellow: "bg-yellow-500" }
const Dot = ({ value }: { value: string }) => <span className={`inline-block size-3.5 rounded-full ${SWATCH[value] ?? "bg-neutral-500"}`} />
const Aa = () => <span className="text-xs font-medium">Aa</span>

export function DesignFields({ design, set }: { design: Design; set: (patch: Partial<Design>) => void }) {
  const label = (k: keyof Design) => DESIGN_OPTIONS[k].find((o) => o.value === design[k])?.label ?? design[k]
  return (
    <>
      <FilterPicker label="Style" value={design.style} options={DESIGN_OPTIONS.style} allLabel={null} onChange={(style) => set({ style })} trailing={<span className="inline-block size-3.5 rounded-[5px] border border-current" />} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Base Color" value={design.baseColor} options={DESIGN_OPTIONS.baseColor} allLabel={null} onChange={(baseColor) => set({ baseColor })} trailing={<Dot value={design.baseColor} />} />
      <FilterPicker label="Theme" value={design.theme} options={DESIGN_OPTIONS.theme} allLabel={null} onChange={(theme) => set({ theme })} trailing={<Dot value={design.theme} />} />
      <FilterPicker label="Chart Color" value={design.chartColor} options={DESIGN_OPTIONS.chartColor} allLabel={null} onChange={(chartColor) => set({ chartColor })} trailing={<Dot value={design.chartColor} />} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Heading" value={design.fontHeading} options={DESIGN_OPTIONS.fontHeading} allLabel={null} onChange={(fontHeading) => set({ fontHeading })} trailing={<Aa />} />
      <FilterPicker label="Font" value={design.font} options={DESIGN_OPTIONS.font} allLabel={null} onChange={(font) => set({ font })} trailing={<Aa />} />
      <FieldSeparator className="hidden md:block" />
      <FilterPicker label="Icon Library" value={design.iconLibrary} options={DESIGN_OPTIONS.iconLibrary} allLabel={null} onChange={(iconLibrary) => set({ iconLibrary })} trailing={<span className="text-xs">◎</span>} />
      <FilterPicker label="Radius" value={design.radius} options={DESIGN_OPTIONS.radius} allLabel={null} onChange={(radius) => set({ radius })} trailing={<span className="inline-block size-3 rounded-tr-lg border-t-2 border-r-2 border-current" />} />
      <span className="sr-only">{label("style")}</span>
    </>
  )
}

/** A short, stable code for a design — what `--preset` shows and Get Code hands over. */
export function presetCode(design: Design) {
  const s = JSON.stringify(design)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(36).padStart(6, "0").slice(0, 6)
}
