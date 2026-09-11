import type { Location, Target } from "@/lib/create/path"
import { isJurisdiction } from "@/lib/filters"
import { chambersOf } from "@/lib/workspace/datasets"

// The workspace's paths (Brendan, 2026-09-07): /create's query keys, as a
// path. The jurisdiction is its two-letter code, the chamber as the record
// names it, the year the session began (Brendan, 2026-09-07: by year, always;
// a year inside a two-year session reads that session), then the node:
//
//   /workspace/data                                    the datasets
//   /workspace/data/us/house                           the dataset, current session
//   /workspace/data/us/house/2025                      the session root
//   /workspace/data/us/house/2025/bills                a listing: bills, committees, members, votes, votes/2026-05, votes/2026-05/floor, sessions, forks
//   /workspace/data/us/house/2025/bill/hb9329          a bill, by its number (or by id, when only the id is known)
//   /workspace/data/us/house/2025/member/schumer-12345 a member, by name and id
//   /workspace/data/us/house/2025/committee/labor      a committee, by its name's slug; /members and /bill/… beneath it
//   /workspace/data/us/house/2025/roll-call/12345      a roll call
//
// Tabs, documents, forks and the look stay in the query, as they were.

export const WORKSPACE_DATA = "/workspace/data"

export type ParsedPath =
  | { kind: "datasets" }
  | {
      kind: "node"
      state: string
      chamber: string
      session: number | null
      /** The location with what the path says; a bill number or a committee slug still to be resolved to the record's key. */
      location: Location
      billNumber?: string
      committeeSlug?: string
    }
  | { kind: "missing"; reason: string }

export const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

function chamberFor(state: string, segment: string): string | undefined {
  return chambersOf(state).find((c) => c.toLowerCase() === segment.toLowerCase())
}

export function parseWorkspacePath(segments: string[]): ParsedPath {
  const [st, ch, sess, ...rest] = segments.map((s) => decodeURIComponent(s))
  if (!st) return { kind: "datasets" }
  const state = st.toUpperCase()
  if (!isJurisdiction(state)) return { kind: "missing", reason: `No jurisdiction "${st}".` }
  const chamber = chamberFor(state, ch ?? "") ?? (ch ? undefined : chambersOf(state)[0])
  if (!chamber) return { kind: "missing", reason: `${state} has no chamber "${ch}".` }
  const session = sess && /^\d+$/.test(sess) ? Number(sess) : null
  if (sess && session === null) return { kind: "missing", reason: `"${sess}" is not a year.` }
  const location: Location = { at: "", committee: "", member: "", bill: "", rollcall: "" }
  const out: ParsedPath = { kind: "node", state, chamber, session, location }
  const [head, a, b, c, d] = rest
  const bill = (x: string | undefined) => {
    if (!x) return
    if (/^\d+$/.test(x)) location.bill = x
    else out.billNumber = x
  }
  switch (head) {
    case undefined:
      break
    case "bills":
    case "committees":
    case "members":
    case "sessions":
    case "forks":
      location.at = head
      break
    case "votes":
      location.at = ["votes", a, b].filter(Boolean).join("/")
      break
    case "bill":
      bill(a)
      break
    case "member":
      location.member = (a ?? "").match(/(\d+)$/)?.[1] ?? ""
      if (!location.member) return { kind: "missing", reason: "A member path ends in the member's id." }
      break
    case "committee":
      if (!a) return { kind: "missing", reason: "Which committee?" }
      out.committeeSlug = a
      if (b === "members") location.at = "members"
      else if (b === "bill") bill(c)
      else if (b === "member") location.member = (c ?? "").match(/(\d+)$/)?.[1] ?? ""
      void d
      break
    case "roll-call":
      location.rollcall = a ?? ""
      break
    default:
      return { kind: "missing", reason: `Nothing lives at "${head}".` }
  }
  return out
}

/** The path for a location, with the hints a target carries: the bill's number, the member's name. */
export function buildWorkspacePath(args: { state: string; chamber: string | null; session: number | null; location: Location; number?: string | null; slug?: string | null }): string {
  const { state, chamber, session, location: loc } = args
  const parts = [WORKSPACE_DATA, state.toLowerCase(), (chamber ?? chambersOf(state)[0]).toLowerCase()]
  if (session) parts.push(String(session))
  const billSeg = () => (args.number ? slugify(args.number) : loc.bill)
  if (loc.committee) {
    parts.push("committee", slugify(loc.committee))
    if (loc.bill) parts.push("bill", billSeg())
    else if (loc.member) parts.push("member", args.slug ? `${slugify(args.slug)}-${loc.member}` : loc.member)
    else if (loc.at === "members") parts.push("members")
  } else if (loc.bill) parts.push("bill", billSeg())
  else if (loc.rollcall) parts.push("roll-call", loc.rollcall)
  else if (loc.member) parts.push("member", args.slug ? `${slugify(args.slug)}-${loc.member}` : loc.member)
  else if (loc.at) parts.push(...loc.at.split("/").filter(Boolean))
  return parts.join("/")
}

/** The location after a target is applied to the current one. */
export function applyTarget(current: Location, target: Target): Location {
  const next = { ...current }
  for (const key of ["at", "committee", "member", "bill", "rollcall"] as const) if (key in target) next[key] = target[key] ?? ""
  return next
}

// ---------------------------------------------------------------------------
// /create retired (Brendan, 2026-09-07): its query keys, translated to the
// workspace. The four surfaces beside the data have paths of their own.

export const SURFACES = ["inbox", "finance", "forms", "documents"] as const
export type Surface = (typeof SURFACES)[number]

export function surfacePath(at: string, all?: string | null): string | null {
  if (at === "admin" || at.startsWith("admin/")) return `/workspace/dashboard${at.slice(5) ? `/${at.slice(6)}` : ""}`
  if (at === "forms") return all === "1" ? "/workspace/documents" : "/workspace/forms"
  if (at === "inbox" || at === "finance") return `/workspace/${at}`
  return null
}

/** The workspace address of a /create URL's search. */
export function fromCreateQuery(search: string): string {
  const q = new URLSearchParams(search)
  const at = q.get("at") ?? ""
  const surface = surfacePath(at, q.get("all"))
  if (surface) return surface
  const state = (q.get("state") ?? "").toUpperCase()
  if (!isJurisdiction(state)) return WORKSPACE_DATA
  const sessionRaw = q.get("session")
  const session = sessionRaw && /^\d+$/.test(sessionRaw) ? Number(sessionRaw) : null
  const chamber = q.get("chamber") && chamberFor(state, q.get("chamber")!) ? chamberFor(state, q.get("chamber")!)! : null
  const location: Location = { at, committee: q.get("committee") ?? "", member: q.get("member") ?? "", bill: q.get("bill") ?? "", rollcall: q.get("rollcall") ?? "" }
  const path = buildWorkspacePath({ state, chamber, session, location })
  const keep = new URLSearchParams()
  for (const key of ["tab", "doc", "fork", "look", "mode", "party", "status", "subject", "vote", "version", "style", "base", "theme", "chart", "heading", "body", "mono", "measure", "scale", "leading", "flow", "icons", "radius"]) {
    const value = q.get(key)
    if (value) keep.set(key, value)
  }
  const rest = keep.toString()
  return rest ? `${path}?${rest}` : path
}
