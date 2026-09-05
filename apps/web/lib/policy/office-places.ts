import type { DirectoryOffice } from "@/lib/policy/db-queries"

const titleCase = (s: string | null) => (s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null)

/** "Valadao, David G. - Bakersfield" → "Bakersfield"; the seat's own office is "Washington". */
export const officeLabel = (o: DirectoryOffice) => {
  if (o.kind === "Member") return "Washington"
  const dash = o.name.indexOf(" - ")
  return dash >= 0 ? o.name.slice(dash + 3).replace(/\s+(District\s+)?Office$/i, "") : o.name
}

/** "Washington D.C." for the seat's office, "Charlotte, NC" for a district one — the Contact lead's places. */
export const officePlaces = (offices: DirectoryOffice[]) =>
  offices.map((o) => (o.kind === "Member" ? "Washington D.C." : [titleCase(o.locality), o.region].filter(Boolean).join(", ") || officeLabel(o)))
