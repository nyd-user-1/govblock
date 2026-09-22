// The block catalogue (Brendan, 2026-09-22).
//
// A block is one shape over one table, in one jurisdiction. That is the whole
// idea, and naming it this way is the point: "data block" and "design block"
// were two names for the same thing, which is why neither shipped. Every card
// on /bills/[id] and on /roll-call-votes is already a shape plus a query —
// a count, or a short list of rows with an emblem, a name and a fact — and
// the catalogue below is those shapes pointed at the tables one at a time.
//
// Ten tables, two shapes, and a reader picks which of them stand on their
// home page. Adding a table is a row in this file; adding a shape is a case
// in components/home/block-body.tsx. Nothing here asks the database anything:
// each block names the resource its tile reads when it is drawn.

export type BlockShape = "count" | "list"

/**
 * One record a block can stand over instead of a whole table (Brendan,
 * 2026-09-22: "how do we use this to add a particular bill?"). A block has two
 * axes now — which table, and how wide: a jurisdiction, or a single record in
 * it. The record is found with the site's own search, so nothing new is asked
 * of the database to pick one.
 */
export type BlockRecord = { id: string; label: string; state: string }

/** The tables whose records the search can find directly; a roll call and an amendment live under a bill and wait their turn. */
export type Pickable = "bills" | "committees" | "members"

export type BlockKey =
  | "bills"
  | "committees"
  | "members"
  | "sessions"
  | "votes"
  | "amendments"
  | "actions"
  | "hearings"
  | "jurisdictions"

export type BlockSpec = {
  key: BlockKey
  /** What the tile is called. */
  label: string
  /** The table it stands over, said plainly — the reader is choosing data, not a widget. */
  table: string
  /** One line for the add panel: what the block shows. */
  description: string
  shape: BlockShape
  /** The API resource the tile reads, and the extra it passes; "" for a block that reads nothing. */
  resource: string
  extra?: Record<string, string | number>
  /** Where the tile's title leads. */
  href: (state: string) => string
  /** Where a single record of this table can be picked, and how its own tile reads it. */
  pick?: {
    kind: Pickable
    /** The resource one record is read from, and the parameter its id goes in. */
    resource: string
    param: "id" | "name"
    href: (record: BlockRecord) => string
  }
}

export const BLOCKS: BlockSpec[] = [
  {
    key: "bills",
    label: "Bills",
    table: "Bills",
    description: "How many bills this session, and the four most recently acted on",
    shape: "list",
    resource: "bills",
    extra: { limit: 4 },
    href: (state) => `/bills/${state.toLowerCase()}`,
    pick: { kind: "bills", resource: "bill", param: "id", href: (r) => `/bills/${r.id}?state=${r.state}` },
  },
  {
    key: "committees",
    label: "Committees",
    table: "Committees",
    description: "The committees with the most bills before them",
    shape: "list",
    resource: "committees",
    href: (state) => `/committees?state=${state}`,
    pick: { kind: "committees", resource: "committee", param: "name", href: (r) => `/bills?state=${r.state}&committee=${encodeURIComponent(r.id)}` },
  },
  {
    key: "members",
    label: "Members",
    table: "People",
    description: "How many are sitting, and how the chamber divides",
    shape: "count",
    resource: "members",
    href: (state) => `/members?state=${state}`,
    pick: { kind: "members", resource: "member", param: "id", href: (r) => `/members/${r.id}?state=${r.state}` },
  },
  {
    key: "sessions",
    label: "Sessions",
    table: "Bills",
    description: "Each session with its span and how many bills it carried",
    shape: "list",
    resource: "sessions",
    href: (state) => `/state/${state.toLowerCase()}`,
  },
  {
    key: "votes",
    label: "Votes",
    table: "Roll Call",
    description: "Roll calls taken this session",
    shape: "count",
    resource: "metric",
    extra: { metric: "votes", days: "session" },
    href: (state) => `/roll-call-votes?state=${state}`,
  },
  {
    key: "amendments",
    label: "Amendments",
    table: "Amendments",
    description: "Amendments offered this session",
    shape: "count",
    resource: "metric",
    extra: { metric: "amendments", days: "session" },
    href: (state) => `/amendments?state=${state}`,
  },
  {
    key: "actions",
    label: "Actions",
    table: "History Table",
    description: "Every action recorded on every bill this session",
    shape: "count",
    resource: "metric",
    extra: { metric: "actions", days: "session" },
    href: (state) => `/bills/${state.toLowerCase()}`,
  },
  {
    key: "hearings",
    label: "Hearings",
    table: "Calendar",
    description: "Hearings the calendar shows held this session",
    shape: "count",
    resource: "metric",
    extra: { metric: "hearings-held", days: "session" },
    href: (state) => `/hearings?state=${state}`,
  },
  {
    key: "jurisdictions",
    label: "Jurisdictions",
    table: "Bills",
    description: "The fifty states, the District and Congress, by what is on file",
    shape: "list",
    resource: "",
    href: () => "/state",
  },
]

export const blockOf = (key: BlockKey) => BLOCKS.find((b) => b.key === key)

/** What a reader starts with: one of each shape, over the tables most people open first. */
export const DEFAULT_BLOCKS: BlockKey[] = ["bills", "votes", "committees", "members"]
