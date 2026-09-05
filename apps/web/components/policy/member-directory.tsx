"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import type { DirectoryOffice, DirectoryStaffer } from "@/lib/policy/db-queries"
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
  const [active, setActive] = React.useState(0)
  const [copied, setCopied] = React.useState(false)
  if (!tabs.length) return null
  const tab = tabs[Math.min(active, tabs.length - 1)]

  async function copy() {
    await navigator.clipboard.writeText(tab.lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <H3>Office</H3>
      <div className="not-typeset relative mt-6 overflow-hidden rounded-xl border border-border/50 bg-surface text-surface-foreground">
        <div data-slot="tabs" className="group/tabs flex gap-0 data-[orientation=horizontal]:flex-col" data-orientation="horizontal">
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1">
            <ChamberSeal state="US" chamber="House" size={16} />
            <div
              data-slot="tabs-list"
              className="group/tabs-list inline-flex h-9 w-fit items-center justify-center rounded-none bg-transparent p-0 text-muted-foreground"
            >
              {tabs.map((t, i) => (
                <button
                  key={t.value}
                  type="button"
                  data-slot="tabs-trigger"
                  data-state={i === active ? "active" : "inactive"}
                  onClick={() => setActive(i)}
                  className="relative inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 pt-0.5 font-mono text-sm font-medium whitespace-nowrap text-foreground/60 shadow-none! transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-[state=active]:border-input data-[state=active]:bg-background! data-[state=active]:text-foreground dark:text-muted-foreground dark:hover:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="no-scrollbar overflow-x-auto">
            <div data-slot="tabs-content" className="mt-0 flex-1 px-4 py-3.5 outline-none">
              <pre className="m-0 bg-transparent p-0">
                <code className="relative font-mono text-sm leading-relaxed">{tab.lines.join("\n")}</code>
              </pre>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy"}
          className="absolute top-2 right-2 z-10 inline-flex size-7 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap opacity-70 transition-all outline-none hover:bg-accent hover:text-accent-foreground hover:opacity-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:opacity-100 dark:hover:bg-accent/50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </>
  )
}

export function MemberStaff({ staff, offices, who, surname }: { staff: DirectoryStaffer[]; offices: DirectoryOffice[]; who: string; surname: string }) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  if (!staff.length) return null
  const label = new Map(offices.map((o) => [o.id, officeLabel(o)]))
  // One line per staffer, the columns padded so the file reads as a table:
  // name, title, office, phone.
  const cells = staff.map((s) => [s.name, s.title ?? "", (s.office_id && label.get(s.office_id)) ?? s.office ?? "", fmtPhone(s.phone) ?? ""])
  const widths = [0, 1, 2].map((i) => Math.max(...cells.map((c) => c[i].length)))
  const lines = cells.map((c) => c.map((v, i) => (i < 3 ? v.padEnd(widths[i] + 2) : v)).join(""))
  const file = `staff/${surname.toLowerCase().replace(/[^a-z]/g, "")}.csv`

  async function copy() {
    await navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <H3>Staff</H3>
      <p>
        {who} has <code>{staff.length}</code> staff listed in the House Directory.
      </p>
      {/* shadcn's file block — the titled code figure with line numbers, the
          copy button, and Expand over a collapsed body — with the House seal
          where the file-type glyph sits (Brendan, 2026-09-05). */}
      <div
        data-state={open ? "open" : "closed"}
        className="not-typeset group/collapsible relative mt-6 overflow-hidden rounded-xl border border-border/50 bg-surface text-surface-foreground data-[state=closed]:max-h-64"
      >
        <figure className="m-0">
          <figcaption className="flex items-center gap-2 border-b border-border/50 py-2 pr-2 pl-4 font-mono text-sm text-foreground [&_svg]:size-4 [&_svg]:opacity-70">
            <ChamberSeal state="US" chamber="House" size={16} />
            {file}
            <div className="ml-auto flex items-center gap-1 text-muted-foreground">
              <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md px-2 py-1 text-sm hover:text-foreground">
                {open ? "Collapse" : "Expand"}
              </button>
              <span className="h-4 w-px bg-border" />
              <button
                type="button"
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy"}
                className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground [&_svg]:size-4"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          </figcaption>
          <pre className="no-scrollbar m-0 min-w-0 overflow-x-auto bg-transparent px-4 py-3.5 font-mono text-sm leading-relaxed">
            <code className="grid">
              {lines.map((line, i) => (
                <span key={staff[i].id} className="grid grid-cols-[2ch_1fr] gap-4">
                  <span className="text-right text-muted-foreground select-none">{i + 1}</span>
                  <span className="whitespace-pre">{line}</span>
                </span>
              ))}
            </code>
          </pre>
        </figure>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute inset-x-0 -bottom-2 flex h-20 items-center justify-center rounded-b-lg bg-gradient-to-b from-surface/70 to-surface text-sm text-muted-foreground"
          >
            Expand
          </button>
        )}
      </div>
    </>
  )
}
