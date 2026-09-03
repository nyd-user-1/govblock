import { FILTER_KEYS, type Filters } from "@/lib/filters"
import { SCOPE_EXTRA_KEYS, type ScopeFilters } from "@/lib/policy/scope"
import { FONTS } from "@/app/(typeset)/lib/fonts"
import { TYPESET_FLOWS, TYPESET_LEADINGS, TYPESET_MEASURES, TYPESET_SIZES } from "@/app/(typeset)/lib/search-params"

// A preset is a view: the scope the rail chose (over fifty jurisdictions,
// twenty years of sessions, chambers, parties, members, committees, topics,
// departments, FEC cycles, forms), the design the cards and the typeset wear,
// and which block is on the stage. Brendan, 2026-09-03: "the unique
// combination of filters allows the user to create the view/preset they can
// then save and revisit."
//
// The code carries the whole thing, so a preset pasted on another machine
// reproduces the view without a server. The six-character name beside it is a
// hash of the same string, short enough for a button, and the key a saved
// preset is filed under in this browser.

export type Option = { value: string; label: string; hint?: string }

// ── Design ─────────────────────────────────────────────────────────────────
//
// One customizer, two variants. The Design variant is the shadcn set (style,
// colours, icons, radius) and the typeset set (measure, faces, size, leading,
// flow) in one panel: the first dresses the cards, the second dresses the bill
// when it opens in typeset. The URL keys for the typeset set are typeset's own
// (`heading`, `body`, `mono`, `scale`, `measure`, `leading`, `flow`), so the
// preview iframe reads them as they are.

export const DESIGN_KEYS = ["style", "base", "theme", "chart", "heading", "body", "mono", "measure", "scale", "leading", "flow", "icons", "radius"] as const
export type DesignKey = (typeof DESIGN_KEYS)[number]
export type Design = Record<DesignKey, string>

const cap = (v: string) => v[0].toUpperCase() + v.slice(1)
const named = (values: string[]) => values.map((value) => ({ value, label: cap(value) }))
const textFonts = FONTS.filter((font) => font.type !== "mono").map((font) => ({ value: font.id, label: font.label }))
const monoFonts = FONTS.filter((font) => font.type === "mono").map((font) => ({ value: font.id, label: font.label }))

export const DESIGN_OPTIONS: Record<DesignKey, Option[]> = {
  style: named(["nova", "luma", "vega", "lyra", "maia", "mira", "sera", "rhea"]),
  base: named(["neutral", "zinc", "stone", "mauve", "olive", "mist", "taupe"]),
  theme: named(["neutral", "blue", "green", "orange", "red", "rose", "violet", "yellow"]),
  chart: named(["neutral", "blue", "green", "orange", "red", "violet"]),
  heading: [{ value: "inherit", label: "Inherit" }, ...textFonts],
  body: textFonts,
  mono: monoFonts,
  measure: TYPESET_MEASURES.map((o) => ({ value: o.value, label: o.label })),
  scale: TYPESET_SIZES.map((o) => ({ value: o.value, label: o.label })),
  leading: TYPESET_LEADINGS.map((o) => ({ value: o.value, label: o.label })),
  flow: TYPESET_FLOWS.map((o) => ({ value: o.value, label: o.label })),
  icons: [{ value: "lucide", label: "Lucide" }, { value: "tabler", label: "Tabler" }, { value: "hugeicons", label: "Hugeicons" }, { value: "phosphor", label: "Phosphor" }],
  radius: [{ value: "none", label: "None" }, { value: "small", label: "Small" }, { value: "medium", label: "Default" }, { value: "large", label: "Large" }],
}

export const DEFAULT_DESIGN: Design = {
  style: "luma",
  base: "neutral",
  theme: "blue",
  chart: "red",
  heading: "inherit",
  body: "geist",
  mono: "geist-mono",
  measure: "80",
  scale: "15",
  leading: "1.75",
  flow: "1.25em",
  icons: "lucide",
  radius: "medium",
}

export const DESIGN_LABEL: Record<DesignKey, string> = {
  style: "Style",
  base: "Base Color",
  theme: "Theme",
  chart: "Chart Color",
  heading: "Heading",
  body: "Font",
  mono: "Mono",
  measure: "Measure",
  scale: "Size",
  leading: "Leading",
  flow: "Flow",
  icons: "Icon Library",
  radius: "Radius",
}

/** A design read off the URL: every key present, defaults filling the gaps. */
export function readDesign(params: Record<string, string>): Design {
  const design = { ...DEFAULT_DESIGN }
  for (const key of DESIGN_KEYS) {
    const value = params[key]
    if (value && DESIGN_OPTIONS[key].some((o) => o.value === value)) design[key] = value
  }
  return design
}

/** Only what differs from the defaults, so the URL and the code stay short. */
export function designDiff(design: Partial<Design>): Partial<Design> {
  const out: Partial<Design> = {}
  for (const key of DESIGN_KEYS) {
    const value = design[key]
    if (value && value !== DEFAULT_DESIGN[key]) out[key] = value
  }
  return out
}

// ── The preset ─────────────────────────────────────────────────────────────

export type Preset = {
  v: 1
  /** The stage: `cards`, or a block's tab value. Absent means cards. */
  block?: string
  /** The rail, `state` and `session` included when chosen. */
  filters: ScopeFilters
  /** Only what differs from the defaults. */
  design: Partial<Design>
}

const FILTER_ORDER = [...FILTER_KEYS, ...SCOPE_EXTRA_KEYS] as const

function compactFilters(filters: ScopeFilters): ScopeFilters {
  const out: ScopeFilters = {}
  for (const key of FILTER_ORDER) {
    const value = filters[key]
    if (value) out[key] = value
  }
  return out
}

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(code: string) {
  const padded = code.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (code.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** The code: the whole preset, URL-safe, no server needed to read it back. */
export function encodePreset(preset: Omit<Preset, "v">): string {
  const body: Preset = { v: 1, filters: compactFilters(preset.filters), design: designDiff(preset.design) }
  if (preset.block && preset.block !== "cards") body.block = preset.block
  return toBase64Url(JSON.stringify(body))
}

/**
 * A code, a saved name, or a create URL, back to a preset. Null when it is
 * none of those. A URL is read by its query string — the same keys the rail
 * writes — so any /create link is itself a preset.
 */
export function decodePreset(input: string, saved: Record<string, SavedPreset> = {}): Preset | null {
  const text = input.trim()
  if (!text) return null
  const fromSaved = saved[text] ?? saved[text.replace(/^--preset\s+/, "")]
  if (fromSaved) return decodePreset(fromSaved.code)
  if (/^https?:\/\//.test(text) || text.startsWith("/")) {
    try {
      const url = new URL(text, "http://govblock")
      const code = url.searchParams.get("preset")
      if (code) return decodePreset(code, saved)
      const params: Record<string, string> = {}
      url.searchParams.forEach((value, key) => (params[key] = value))
      return presetFromParams(params)
    } catch {
      return null
    }
  }
  try {
    const parsed = JSON.parse(fromBase64Url(text.replace(/^--preset\s+/, ""))) as Partial<Preset>
    if (!parsed || parsed.v !== 1 || typeof parsed !== "object") return null
    return {
      v: 1,
      block: typeof parsed.block === "string" ? parsed.block : undefined,
      filters: compactFilters((parsed.filters ?? {}) as ScopeFilters),
      design: designDiff((parsed.design ?? {}) as Partial<Design>),
    }
  } catch {
    return null
  }
}

/** The preset a set of URL params describes. */
export function presetFromParams(params: Record<string, string>): Preset {
  const filters: ScopeFilters = {}
  for (const key of FILTER_ORDER) if (params[key]) filters[key] = params[key]
  return { v: 1, block: params.block || undefined, filters, design: designDiff(readDesign(params)) }
}

/** The URL params a preset writes — every key it owns, empty where it is silent, so the old view clears. */
export function presetToParams(preset: Preset): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of FILTER_ORDER) out[key] = preset.filters[key] ?? ""
  for (const key of DESIGN_KEYS) out[key] = preset.design[key] ?? ""
  out.block = preset.block && preset.block !== "cards" ? preset.block : ""
  return out
}

/** Six characters, stable for the same code: the name on the button, the key in the drawer. */
export function presetName(code: string) {
  let h = 2166136261
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h.toString(36).padStart(6, "0").slice(-6)
}

// ── Saved presets, in this browser ─────────────────────────────────────────
//
// The same place pinned committees and inbox threads live until there is an
// account to attach them to. The code is the record; the name is its key.

export const PRESETS_KEY = "govblock:presets"

export type SavedPreset = { code: string; label: string; at: number }

/** One line that says what a preset is, for the drawer and the Open dialog. */
export function describePreset(preset: Preset, stateName: (code: string | undefined) => string) {
  const parts: string[] = []
  parts.push(preset.block ? cap(preset.block) : "Cards")
  parts.push(stateName(preset.filters.state) || "Any state")
  if (preset.filters.session) parts.push(preset.filters.session)
  for (const key of ["chamber", "committee", "party", "status", "subject", "department"] as const) {
    if (preset.filters[key]) parts.push(preset.filters[key]!)
  }
  const design = Object.keys(preset.design).length
  if (design) parts.push(`${design} design ${design === 1 ? "change" : "changes"}`)
  return parts.join(" · ")
}

/** A lower-case type guard for the filter keys the rail owns. */
export function isFilterKey(key: string): key is keyof Filters {
  return (FILTER_KEYS as readonly string[]).includes(key)
}
