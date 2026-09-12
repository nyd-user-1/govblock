// The shape a bill comparison arrives in — the printings, each pass, each
// row — apart from the server file that builds it, so the redline component
// can travel without the database behind it (2026-09-12).

/** A span of a line that changed, by character offset. */
export type Mark = { from: number; to: number }

export type CompareRow = {
  change: "same" | "add" | "del"
  text: string
  marks?: Mark[]
  /** Page furniture — running heads, page numbers — dimmed as the bill page dims it. */
  furniture?: boolean
  /** The change block a removed or added line belongs to, and its place among that block's removals or additions. */
  block?: number
  order?: number
}

export type ComparePass = { from: string; to: string; rows: CompareRow[] }

export type BillComparison = {
  href: string
  number: string
  title: string
  printings: string[]
  passes: ComparePass[]
}
