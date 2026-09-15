import { STATE_NAMES } from "@/lib/xml/address"

// The library's routes and names (window 4, 2026-09-14), shared by the
// server and the browser. A library is a prefix of addresses (a session, a
// code, a constitution) or a family of law (lib/xml/families.ts); a Work
// opens in the XML view by its address.
//
//   /workspace/typeset/library                          every library
//   /workspace/typeset/library/agricultural-law         a family
//   /workspace/typeset/library/us-ny/code/agm           a prefix: New York's Agriculture and Markets Law
//   /workspace/typeset/work/us-ny/code/agm/s3           a Work in the XML view
//   /workspace/typeset/work/us-ny/code/agm/s3?at=2024-01-01

export const LIBRARY_ROOT = "/workspace/typeset/library"
export const WORK_ROOT = "/workspace/typeset/work"
export const STATUTE_ROOT = "/workspace/typeset/statute"

// Typeset's URLs (Brendan, 2026-09-15): a bill lives at /workspace/typeset/bill/<id>/<view>,
// a statute at /workspace/typeset/statute/<jurisdiction>/<code>/<section>. The
// address form under /work/ is only a door that redirects to one of those.
const KINDS_KEPT = new Set(["usc", "const", "pl", "law"])

/** `/us-ny/code/agm/s16@2024-01-01` → `/workspace/typeset/statute/us-ny/agm/s16@2024-01-01`; the `code` segment is implied by the route. */
export const statuteHref = (address: string, at?: string | null) => {
  const [, jurisdiction, kind, ...rest] = address.split("/")
  const path = [jurisdiction, ...(kind === "code" ? [] : [kind]), ...rest].join("/")
  return `${STATUTE_ROOT}/${path}${at ? `?at=${at}` : ""}`
}

/** The address a statute route received, back to the store's form: `code` returns unless the kind is one the route keeps. */
export const statuteAddress = (parts: string[]) => {
  const [jurisdiction, next, ...rest] = parts.map((p) => decodeURIComponent(p))
  return next && KINDS_KEPT.has(next) ? `/${[jurisdiction, next, ...rest].join("/")}` : `/${[jurisdiction, "code", next, ...rest].filter(Boolean).join("/")}`
}

/** A family's slug or a prefix address, under the library. */
export const libraryHref = (slugOrPrefix?: string | null) => (slugOrPrefix ? `${LIBRARY_ROOT}/${slugOrPrefix.replace(/^\/+/, "")}` : LIBRARY_ROOT)

/** A Work, or one Expression of it, in the XML view. `@` is a legal path character, so the address is the path as written. */
export const workHref = (address: string, at?: string | null) =>
  address.split("/")[2] === "bill" ? `${WORK_ROOT}${address}${at ? `?at=${at}` : ""}` : statuteHref(address, at)

const titleCase = (slug: string) => slug.split("-").map((w) => (w === "of" ? w : w[0].toUpperCase() + w.slice(1))).join(" ")

/** "us-ny" → "New York"; "us" → "United States". */
export const JURISDICTION_NAMES: Record<string, string> = {
  us: "United States",
  ...Object.fromEntries(Object.entries(STATE_NAMES).map(([slug, code]) => [`us-${code}`, titleCase(slug)])),
}

export const jurisdictionName = (jurisdiction: string) => JURISDICTION_NAMES[jurisdiction] ?? jurisdiction.toUpperCase()

/** A jurisdiction's name as the `/` command spells it: "us-ny" → "new-york". */
export const jurisdictionSlug = (jurisdiction: string) => jurisdictionName(jurisdiction).toLowerCase().replace(/[^a-z0-9]+/g, "-")

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`

/** The prefix a Work is browsed under: its session for a bill, its code for a section, the constitution for an article's section. */
export function prefixOfWork(work: string): string {
  const [, jurisdiction, kind, first, second] = work.split("/")
  if (kind === "bill") return `/${jurisdiction}/bill/${first}`
  if (kind === "const") return `/${jurisdiction}/const`
  if (kind === "pl") return `/${jurisdiction}/pl/${first}`
  void second
  return `/${jurisdiction}/${kind}/${first}`
}

/** What a reader calls a prefix. `sample` is a stored label under it ("Agriculture & Markets § 3"), the only place a code's name is kept. */
export function prefixLabel(prefix: string, sample?: string | null): string {
  const [, jurisdiction, kind, first] = prefix.split("/")
  const name = jurisdictionName(jurisdiction ?? "")
  if (!kind) return name
  if (kind === "bill") {
    if (!first) return jurisdiction === "us" ? "Bills of Congress" : `${name} bills`
    if (jurisdiction === "us") return `${ordinal(Number(first))} Congress`
    const special = /^(\d{4})s(\d+)?/.exec(first)
    return special ? `${name} ${special[1]}${special[2] ? ` ${ordinal(Number(special[2]))} Special Session` : " Special Session"}` : `${name} ${first}`
  }
  if (kind === "const") return `${name} Constitution`
  if (kind === "pl") return first ? `Public Laws of the ${ordinal(Number(first))} Congress` : "Public Laws"
  if (!first) return kind === "usc" ? "United States Code" : `${name} code`
  const law = sample?.split(" § ")[0]?.split(", ")[0]?.trim()
  if (kind === "usc") return `Title ${first.replace(/^t/, "").toUpperCase()}${law ? `, ${law}` : ""}`
  return law || first.toUpperCase()
}
