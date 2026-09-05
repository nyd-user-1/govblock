import type { DirectoryOffice, DirectoryStaffer } from "@/lib/policy/db-queries"
import { H2, Table } from "@/components/typeset"

// The member's own offices and the people in them, from the House Telephone
// Directory (directory.house.gov). Server-rendered with the page: the
// directory is a table of ours, not a fetch, so a shared link and a crawler see
// the staff the way a reader does.

/** `2022254231` → `(202) 225-4231`; anything else is left alone. */
export const fmtPhone = (raw: string | null | undefined) => {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return raw ?? null
}

/** "Valadao, David G. - Bakersfield" → "Bakersfield"; the seat's own office is "Washington". */
const officeLabel = (o: DirectoryOffice) => {
  if (o.kind === "Member") return "Washington"
  const dash = o.name.indexOf(" - ")
  return dash >= 0 ? o.name.slice(dash + 3).replace(/\s+(District\s+)?Office$/i, "") : o.name
}

const titleCase = (s: string | null) =>
  s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null

export function MemberOffices({ offices }: { offices: DirectoryOffice[] }) {
  if (!offices.length) return null
  return (
    <>
      <H2>Offices</H2>
      <Table>
        <thead>
          <tr>
            <th>Office</th>
            <th>Address</th>
            <th className="pr-10">Phone</th>
          </tr>
        </thead>
        <tbody>
          {offices.map((o) => (
            <tr key={o.id}>
              <td>{officeLabel(o)}</td>
              <td>
                {[o.street, [titleCase(o.locality), o.region].filter(Boolean).join(", "), o.postal]
                  .filter(Boolean)
                  .join(" · ")}
              </td>
              <td className="whitespace-nowrap pr-10 tabular-nums">{fmtPhone(o.phone) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

export function MemberStaff({ staff, offices }: { staff: DirectoryStaffer[]; offices: DirectoryOffice[] }) {
  if (!staff.length) return null
  const label = new Map(offices.map((o) => [o.id, officeLabel(o)]))
  return (
    <>
      <H2>Staff</H2>
      <p>
        {staff.length} on the House Telephone Directory.
      </p>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Office</th>
            <th className="pr-10">Phone</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap">{s.name}</td>
              <td>{s.title ?? "—"}</td>
              <td className="whitespace-nowrap">{(s.office_id && label.get(s.office_id)) ?? s.office ?? "—"}</td>
              <td className="whitespace-nowrap pr-10 tabular-nums">{fmtPhone(s.phone) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}
