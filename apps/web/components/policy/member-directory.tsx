"use client"

import * as React from "react"
import type { DirectoryOffice, DirectoryStaffer } from "@/lib/policy/db-queries"
import { CommandBlock } from "@/components/command-block"
import { FileBlock } from "@/components/file-block"
import { ChamberSeal } from "@/components/policy/imagery"
import { H3 } from "@/components/typeset"

// The member's own offices and the people in them, from the House Telephone
// Directory (directory.house.gov).

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

const titleCase = (s: string | null) => (s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null)

/** One office as one line: "Washington  2436 RHOB · Washington, DC · 20515-3312 (202) 225-1510". */
const officeLine = (o: DirectoryOffice) => {
  const address = [o.street, [titleCase(o.locality), o.region].filter(Boolean).join(", "), o.postal].filter(Boolean).join(" · ")
  return `${officeLabel(o)}  ${[address, fmtPhone(o.phone)].filter(Boolean).join(" ")}`
}

// The Office block is shadcn's command block — the package-manager tabs, the
// copy button, the mono line — repurposed by Brendan on 2026-09-05:
// Washington and District as the tabs, an office per line, and the House seal
// where the terminal glyph sat, as on the staff block.
export function MemberOffices({ offices }: { offices: DirectoryOffice[] }) {
  const tabs = React.useMemo(() => {
    const washington = offices.filter((o) => o.kind === "Member")
    const district = offices.filter((o) => o.kind !== "Member")
    return [
      { value: "washington", label: "Washington", lines: washington.map(officeLine) },
      { value: "district", label: "District", lines: district.map(officeLine) },
    ].filter((t) => t.lines.length)
  }, [offices])
  if (!tabs.length) return null
  return (
    <>
      <H3>Office</H3>
      <CommandBlock tabs={tabs} icon={<ChamberSeal state="US" chamber="House" size={16} />} />
    </>
  )
}

export function MemberStaff({ staff, offices, who, surname }: { staff: DirectoryStaffer[]; offices: DirectoryOffice[]; who: string; surname: string }) {
  if (!staff.length) return null
  const label = new Map(offices.map((o) => [o.id, officeLabel(o)]))
  // One line per staffer, the columns padded so the file reads as a table:
  // name, title, office, phone.
  const cells = staff.map((s) => [s.name, s.title ?? "", (s.office_id && label.get(s.office_id)) ?? s.office ?? "", fmtPhone(s.phone) ?? ""])
  const widths = [0, 1, 2].map((i) => Math.max(...cells.map((c) => c[i].length)))
  const lines = cells.map((c) => c.map((v, i) => (i < 3 ? v.padEnd(widths[i] + 2) : v)).join(""))
  const file = `staff/${surname.toLowerCase().replace(/[^a-z]/g, "")}.csv`

  return (
    <>
      <H3>Staff</H3>
      <p>
        {who} has <code>{staff.length}</code> staff listed in the House Directory.
      </p>
      {/* shadcn's file block — the titled code figure with line numbers, the
          copy button, and Expand over a collapsed body — with the House seal
          where the file-type glyph sits (Brendan, 2026-09-05). */}
      <FileBlock icon={<ChamberSeal state="US" chamber="House" size={16} />} title={file} lines={lines} text={() => lines.join("\n")} />
    </>
  )
}
