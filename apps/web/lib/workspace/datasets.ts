import { STATE_CODES, STATE_NAMES, lowerChamber } from "@/lib/filters"

// /workspace/data (Brendan, 2026-09-07): every dataset the site can hand a
// reader, as a catalogue the grid draws one card from. Congress first, then
// New York, then the federal departments, then every other state A–Z with a
// card per chamber — Nebraska's one Legislature, the District's one Council —
// in the order the cards stood on the old /create grid, the new ones after.
//
// Who may open what is decided here too, from two facts the page knows:
// whether the reader is signed in, and which jurisdiction is theirs (the
// header's flag). Congress is open to everyone; a signed-in reader's home
// state is theirs as well; every other state and every department waits on a
// paid plan, which does not exist yet.

export type Dataset = {
  key: string
  title: string
  /** The jurisdiction the files are of; departments have none. */
  state?: string
  /** The chamber as the record names it (`Bills.body`); the Explore filter. */
  chamber?: string
  seal: { kind: "chamber"; state: string; chamber: string } | { kind: "image"; src: string }
  /** Where the card belongs: the two houses of Congress, a state's chambers, or a federal department. */
  group: "congress" | "state" | "department"
}

const chamberTitle = (state: string, chamber: string) => {
  if (state === "US") return `U.S. ${chamber}`
  if (state === "NY") return `NYS ${chamber}`
  if (state === "DC") return "D.C. Council"
  return `${STATE_NAMES[state]} ${chamber}`
}

const chamberCard = (state: string, chamber: string): Dataset => ({
  key: `${state.toLowerCase()}-${chamber.toLowerCase()}`,
  title: chamberTitle(state, chamber),
  state,
  chamber,
  seal: { kind: "chamber", state, chamber },
  group: state === "US" ? "congress" : "state",
})

/** The chambers a jurisdiction seats, as the record names them. */
export function chambersOf(state: string): string[] {
  if (state === "NE") return ["Legislature"]
  if (state === "DC") return ["Council"]
  return [lowerChamber(state), "Senate"]
}

const DEPARTMENTS: Dataset[] = [
  { key: "fec", title: "Federal Election Commission", seal: { kind: "image", src: "/seals/federal-election-commission.png" }, group: "department" },
  { key: "hud", title: "Housing & Urban Development", seal: { kind: "image", src: "/seals/department-of-housing-and-urban-development.png" }, group: "department" },
  { key: "irs", title: "Internal Revenue Service", seal: { kind: "image", src: "/chambers/us.png" }, group: "department" },
  { key: "opm", title: "Office of Personnel Management", seal: { kind: "image", src: "/seals/office-of-personnel-management.png" }, group: "department" },
  { key: "sba", title: "Small Business Administration", seal: { kind: "image", src: "/seals/small-business-administration.png" }, group: "department" },
  { key: "ssa", title: "Social Security Administration", seal: { kind: "image", src: "/seals/social-security-administration.png" }, group: "department" },
  { key: "gsa", title: "General Services Administration", seal: { kind: "image", src: "/seals/general-services-administration.png" }, group: "department" },
  { key: "dol", title: "Department of Labor", seal: { kind: "image", src: "/seals/department-of-labor.png" }, group: "department" },
]

export const DATASETS: Dataset[] = [
  chamberCard("US", "House"),
  chamberCard("US", "Senate"),
  ...chambersOf("NY").map((c) => chamberCard("NY", c)),
  ...DEPARTMENTS,
  // The states A–Z as STATE_CODES orders them, the District last; New York is already above.
  ...[...STATE_CODES, "DC"].filter((code) => code !== "NY").flatMap((code) => chambersOf(code).map((c) => chamberCard(code, c))),
]

// ---------------------------------------------------------------------------
// Where a dataset lives: /workspace/data/congress/house,
// /workspace/data/new-york/assembly, /workspace/data/nebraska/legislature.

export function jurisdictionSlug(state: string): string {
  if (state === "US") return "congress"
  return STATE_NAMES[state].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export function datasetPath(dataset: Dataset): string | null {
  if (!dataset.state || !dataset.chamber) return null
  return `/workspace/data/${jurisdictionSlug(dataset.state)}/${dataset.chamber.toLowerCase()}`
}

export function findDataset(jurisdiction: string, chamber: string): Dataset | undefined {
  return DATASETS.find((d) => d.state && d.chamber && jurisdictionSlug(d.state) === jurisdiction.toLowerCase() && d.chamber.toLowerCase() === chamber.toLowerCase())
}

export type Access = "open" | "locked"

/** Whether this reader may open the dataset. */
export function accessTo(dataset: Dataset, reader: { signedIn: boolean; home: string }): Access {
  if (dataset.group === "congress") return "open"
  if (dataset.group === "state" && reader.signedIn && dataset.state === reader.home) return "open"
  return "locked"
}

// ---------------------------------------------------------------------------
// The layout: the order of the cards, each one's size on the four-column grid,
// the ones the reader deleted, and the session each card is set to. Lives in
// the browser, as the home page's tiles do.

export type Size = { cols: 1 | 2 | 3 | 4; rows: 1 | 2 }

export const DEFAULT_SIZE: Size = { cols: 1, rows: 1 }

export const SIZE_CHOICES: { label: string; size: Size }[] = [
  { label: "Small (1×1)", size: { cols: 1, rows: 1 } },
  { label: "Wide (2×1)", size: { cols: 2, rows: 1 } },
  { label: "Tall (1×2)", size: { cols: 1, rows: 2 } },
  { label: "Large (2×2)", size: { cols: 2, rows: 2 } },
  { label: "Row (4×1)", size: { cols: 4, rows: 1 } },
  { label: "Double row (4×2)", size: { cols: 4, rows: 2 } },
]

export const sameSize = (a: Size, b: Size) => a.cols === b.cols && a.rows === b.rows

// A card's colour (Brendan, 2026-09-07): the design customizer's theme set,
// as the primary the card's first button and its accents are drawn in.
export type Color = "neutral" | "blue" | "green" | "orange" | "red" | "rose" | "violet" | "yellow"

export const COLORS: { value: Color; label: string; primary: string; foreground: string; swatch: string }[] = [
  { value: "neutral", label: "Neutral", primary: "var(--foreground)", foreground: "var(--background)", swatch: "bg-neutral-500" },
  { value: "blue", label: "Blue", primary: "oklch(0.546 0.245 262.881)", foreground: "oklch(0.985 0 0)", swatch: "bg-blue-600" },
  { value: "green", label: "Green", primary: "oklch(0.627 0.194 149.214)", foreground: "oklch(0.985 0 0)", swatch: "bg-green-600" },
  { value: "orange", label: "Orange", primary: "oklch(0.705 0.213 47.604)", foreground: "oklch(0.985 0 0)", swatch: "bg-orange-500" },
  { value: "red", label: "Red", primary: "oklch(0.577 0.245 27.325)", foreground: "oklch(0.985 0 0)", swatch: "bg-red-600" },
  { value: "rose", label: "Rose", primary: "oklch(0.645 0.246 16.439)", foreground: "oklch(0.985 0 0)", swatch: "bg-rose-500" },
  { value: "violet", label: "Violet", primary: "oklch(0.541 0.281 293.009)", foreground: "oklch(0.985 0 0)", swatch: "bg-violet-600" },
  { value: "yellow", label: "Yellow", primary: "oklch(0.795 0.184 86.047)", foreground: "oklch(0.205 0 0)", swatch: "bg-yellow-500" },
]

export type Layout = {
  order: string[]
  sizes: Record<string, Size>
  hidden: string[]
  sessions: Record<string, number>
  colors: Record<string, Color>
}

export const EMPTY_LAYOUT: Layout = { order: [], sizes: {}, hidden: [], sessions: {}, colors: {} }

/** A layout saved before `colors` existed still reads. */
export function readLayout(raw: Partial<Layout> | null | undefined): Layout {
  return { ...EMPTY_LAYOUT, ...(raw ?? {}), colors: raw?.colors ?? {}, sessions: raw?.sessions ?? {} }
}

export const LAYOUT_KEY = "govblock:workspace:data"

/** The cards in the order the reader left them, the catalogue's newcomers after, the deleted ones out. */
export function arrange<T extends { key: string }>(layout: Layout, catalogue: T[]): T[] {
  const byKey = new Map(catalogue.map((d) => [d.key, d]))
  const hidden = new Set(layout.hidden)
  const seen = new Set<string>()
  const out: T[] = []
  for (const key of layout.order) {
    const d = byKey.get(key)
    if (d && !seen.has(key) && !hidden.has(key)) out.push(d)
    seen.add(key)
  }
  for (const d of catalogue) if (!seen.has(d.key) && !hidden.has(d.key)) out.push(d)
  return out
}

/** `key` moved to sit where `before` is; the others keep their order. */
export function reorder(current: { key: string }[], key: string, before: string): string[] {
  const keys = current.map((d) => d.key)
  const from = keys.indexOf(key)
  const to = keys.indexOf(before)
  if (from < 0 || to < 0 || from === to) return keys
  keys.splice(from, 1)
  keys.splice(to, 0, key)
  return keys
}
