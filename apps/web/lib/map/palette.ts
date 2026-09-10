// How layers keep their identity when they sit on top of one another
// (Brendan, 2026-09-10, pointing at Solar's balancing-authority map).
//
// Solar's rule, and it is the right one: a categorical region is a wash of
// its own colour with a white hairline around it. Several washes over one
// another still read, because the white lines never blend and the eye
// follows an edge before it judges a hue. Hues come off the golden angle,
// which spreads any number of neighbours as far apart as the wheel allows,
// so 3,235 counties or 33,000 ZIPs never repeat next to themselves.

const GOLDEN_ANGLE = 137.508

/** A stable colour for a key, spread as far from its neighbours as the wheel allows. */
export function keyColor(
  key: string,
  { sat = 58, lit = 68 }: { sat?: number; lit?: number } = {}
) {
  let n = 0
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0
  const hue = (n * GOLDEN_ANGLE) % 360
  // A little variation keeps two neighbouring hues from reading as one.
  return `hsl(${hue.toFixed(1)},${sat + (n % 3) * 6}%,${lit + (n % 2) * 6}%)`
}

/**
 * What a layer is worth on the stack. A categorical wash is the ground a
 * reader reads region from; a reading is a ramp over it; a boundary is a
 * line and costs the stack nothing.
 */
export const LAYER = {
  /** One wash alone. */
  solo: 0.55,
  /** Each wash when several share the stage — they add, never hide. */
  shared: 0.34,
  /** The one under the pointer. */
  lift: 0.2,
  /** The hairline every categorical region wears, so the edges survive a stack. */
  hairline: { color: "#ffffff", width: 0.7, opacity: 0.85 },
} as const

/** The steps a counted reading climbs, light to dark, in the site's blue. */
export const RAMP = ["#dbe4ff", "#a9bdff", "#6f8fff", "#3b5cff", "#1f3ed6"]

/** Money reads amber, as Solar reads it. */
export const MONEY_RAMP = [
  "#fef3c7",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#92400e",
]

/** Heat reads warm, from nothing to a lot. */
export const HEAT_RAMP = ["#f1f5f9", "#fed7aa", "#fb923c", "#ea580c", "#9a3412"]

/** The parties, in the colours the country reads them in. */
export const PARTY_COLORS: Record<string, string> = {
  D: "#2563eb",
  R: "#dc2626",
  I: "#7c3aed",
}

/** A delegation's balance, from solidly one way to solidly the other. */
export const SPLIT_RAMP = [
  "#dc2626",
  "#f87171",
  "#c4b5fd",
  "#60a5fa",
  "#2563eb",
]

export const NO_DATA = "#e5e7eb"
