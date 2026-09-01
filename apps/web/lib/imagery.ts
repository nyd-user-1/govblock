// Ported from livingston-v3 lib/policy/imagery.ts — which picture a thing gets.
import { flagUrl } from "@/lib/filters"

const SEALS: Record<string, string> = {
  "NY:Senate": "/chambers/ny-senate.avif",
  "NY:Assembly": "/chambers/ny-assembly.avif",
  "NY:": "/chambers/ny.avif",
  "US:Senate": "/chambers/us-senate.png",
  "US:House": "/chambers/us-house.png",
  "US:": "/chambers/us.png",
}

export function chamberImage(state: string, chamber?: string | null) {
  const code = (state || "").toUpperCase()
  const body = chamber ?? ""
  return SEALS[`${code}:${body}`] ?? SEALS[`${code}:`] ?? flagUrl(code || "US")
}

export function hasSeal(state: string, chamber?: string | null) {
  const code = (state || "").toUpperCase()
  return `${code}:${chamber ?? ""}` in SEALS || `${code}:` in SEALS
}

export function portraitFor(member: { photo_url?: string | null }) {
  return member.photo_url ?? null
}

export const PARTY_BLUE = "var(--color-blue-600)"
export const PARTY_RED = "var(--color-red-600)"
export const PARTY_GREY = "var(--color-muted-foreground)"
export const PARTY_OTHER = "var(--color-amber-500)"

export function partyColor(
  party: string | null | undefined,
  { serving = true }: { serving?: boolean } = {}
) {
  if (!serving) return PARTY_GREY
  const code = (party ?? "").toUpperCase().slice(0, 1)
  if (code === "D") return PARTY_BLUE
  if (code === "R") return PARTY_RED
  return PARTY_OTHER
}
