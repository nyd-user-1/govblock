// The footer's Filter chip (Brendan, 2026-09-07): how a listing's rows are
// ordered — A–Z by name, by type (folders, then each kind of record), or
// by time, newest first. It rides the URL as `sort`; absent, the rows keep
// the order the record gave them and the layout the reader made.
export type SortKey = "az" | "type" | "time"

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "az", label: "A–Z" },
  { value: "type", label: "By type" },
  { value: "time", label: "By time" },
]

export function readSort(value: string | undefined | null): SortKey | null {
  return value === "az" || value === "type" || value === "time" ? value : null
}

/** Rows sorted by the key; `kind` ranks the types, `time` is a sortable date string or null. */
export function sortRows<T>(rows: T[], sort: SortKey | null, by: { name: (row: T) => string; kind: (row: T) => string; time: (row: T) => string | null | undefined }): T[] {
  if (!sort) return rows
  const out = [...rows]
  if (sort === "az") out.sort((a, b) => by.name(a).localeCompare(by.name(b), undefined, { numeric: true, sensitivity: "base" }))
  else if (sort === "type") out.sort((a, b) => by.kind(a).localeCompare(by.kind(b)) || by.name(a).localeCompare(by.name(b), undefined, { numeric: true, sensitivity: "base" }))
  else out.sort((a, b) => (by.time(b) ?? "").localeCompare(by.time(a) ?? ""))
  return out
}
