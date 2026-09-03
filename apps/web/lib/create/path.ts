// Where you are in a legislature, read off the URL. Brendan, 2026-09-03: the
// jurisdiction is the organization, the session is the repository, and the
// tree lives inside one repository. Nothing is nested inside anything else.
//
// The URL is the customizer's own keys — `state`, `session`, `committee`,
// `member`, `bill` — plus `at`, which names which listing you are looking at
// when no record is chosen, and `rollcall`, which names one roll call. So
// clicking Labor in the tree and choosing Labor in the customizer are the
// same act, and the two can never disagree.
//
//   at=sessions                    the organization: every session
//   (nothing)                      the repository root: Bills · Committees · Members · Votes
//   at=bills                       every bill, flat, newest first
//   bill=2157698                   a bill (Text · Record · Typeset)
//   at=committees                  every committee; chamber is its type
//   committee=Labor                the committee's bills (at=members for its roster)
//   at=members                     every member; party is a column
//   member=1234                    a member (Record · Bills · Votes)
//   at=votes                       the months with roll calls
//   at=votes/2026-05               a month: Floor · Committee
//   at=votes/2026-05/floor         that month's floor roll calls
//   rollcall=1707303               one roll call: the tally and every position
//
// Three roots sit beside the legislature and are reached from the customizer's
// menu: inbox, finance, forms.

export type Node =
  | { kind: "sessions" }
  | { kind: "root" }
  | { kind: "bills" }
  | { kind: "bill"; id: number }
  | { kind: "committees" }
  | { kind: "committee"; name: string; sub: "bills" | "members" }
  | { kind: "members" }
  | { kind: "member"; id: number }
  | { kind: "votes" }
  | { kind: "votes-month"; month: string }
  | { kind: "votes-kind"; month: string; vote: "floor" | "committee" }
  | { kind: "rollcall"; id: number }
  | { kind: "inbox" }
  | { kind: "finance" }
  | { kind: "forms" }

/** The URL keys a location is made of. */
export type Location = { at: string; committee: string; member: string; bill: string; rollcall: string }

/** What a click writes: keys to set, `null` to clear, absent to leave alone. */
export type Target = Partial<Record<keyof Location | "session" | "chamber" | "tab", string | null>>

export const ROOT_FOLDERS = [
  { key: "bills", label: "Bills", go: { at: "bills" } as Target },
  { key: "committees", label: "Committees", go: { at: "committees" } as Target },
  { key: "members", label: "Members", go: { at: "members" } as Target },
  { key: "votes", label: "Votes", go: { at: "votes" } as Target },
] as const

const SPECIAL = new Set(["inbox", "finance", "forms"])

/** The node the URL names. A record beats a listing: a bill is a bill wherever it was reached from. */
export function locate(loc: Location): Node {
  if (SPECIAL.has(loc.at)) return { kind: loc.at as "inbox" | "finance" | "forms" }
  if (loc.bill && /^\d+$/.test(loc.bill)) return { kind: "bill", id: Number(loc.bill) }
  if (loc.rollcall && /^\d+$/.test(loc.rollcall)) return { kind: "rollcall", id: Number(loc.rollcall) }
  if (loc.member && /^\d+$/.test(loc.member)) return { kind: "member", id: Number(loc.member) }
  if (loc.committee) return { kind: "committee", name: loc.committee, sub: loc.at === "members" ? "members" : "bills" }
  const [head, a, b] = loc.at.split("/").filter(Boolean).map(decodeURIComponent)
  switch (head) {
    case "sessions":
      return { kind: "sessions" }
    case "bills":
      return { kind: "bills" }
    case "committees":
      return { kind: "committees" }
    case "members":
      return { kind: "members" }
    case "votes":
      if (a && b === "floor") return { kind: "votes-kind", month: a, vote: "floor" }
      if (a && b === "committee") return { kind: "votes-kind", month: a, vote: "committee" }
      return a ? { kind: "votes-month", month: a } : { kind: "votes" }
    default:
      return { kind: "root" }
  }
}

/** A record is a node with tabs rather than children. */
export function isFile(node: Node) {
  return node.kind === "bill" || node.kind === "member" || node.kind === "rollcall"
}

export function isSpecial(node: Node) {
  return node.kind === "inbox" || node.kind === "finance" || node.kind === "forms"
}

/** The target that leaves every record behind and lands on a listing. */
export function listing(at: string | null): Target {
  return { at, committee: null, member: null, bill: null, rollcall: null }
}

/** A stable key for a tree branch, so open state and highlighting can name it. */
export function keyOf(node: Node): string {
  switch (node.kind) {
    case "bill":
      return `bills/${node.id}`
    case "committee":
      return `committees/*/${node.name}/${node.sub}`
    case "member":
      return `members/${node.id}`
    case "votes-month":
      return `votes/${node.month}`
    case "votes-kind":
      return `votes/${node.month}/${node.vote}`
    case "rollcall":
      return `rollcalls/${node.id}`
    case "root":
      return ""
    default:
      return node.kind
  }
}

/** The month a roll call belongs to, and its name. */
export const monthOf = (date: string) => String(date ?? "").slice(0, 7)
export function monthName(m: string) {
  const [y, mm] = m.split("-")
  const d = new Date(Number(y), Number(mm) - 1, 1)
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-US", { month: "long", year: "numeric" }) : m
}

/** Floor or committee, as the source labels the roll call. */
export function voteKind(r: { description?: string | null; chamber?: string | null }): "floor" | "committee" {
  const d = (r.description ?? "").toLowerCase()
  return d.includes("committee") || d.includes("tally sheet") || r.chamber === "J" ? "committee" : "floor"
}

/** "Senate Health Committee Vote" → the committee's name, when a roll call names one. */
export function committeeOf(description: string | null | undefined) {
  const m = /^(?:Senate|Assembly|House|Joint)?\s*(.+?)\s+Committee\b/i.exec(description ?? "")
  return m?.[1]?.trim() || null
}
