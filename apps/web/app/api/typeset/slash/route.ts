import { NextResponse } from "next/server"

import { fmtBill } from "@/lib/format"
import { q } from "@/lib/policy/db"
import { findExpression } from "@/lib/typeset/expression-document"
import { typesetHref } from "@/lib/typeset/views"
import { billWork, formatAddress, parseAddress, resolveSlash, type SlashTarget } from "@/lib/xml/address"
import { familyBySlug } from "@/lib/xml/families"
import { JURISDICTION_NAMES, jurisdictionName, jurisdictionSlug, libraryHref, workHref } from "@/lib/xml/library"
import { codeName, familyCodes, jurisdictionFamily, loadCatalogue, type CatalogueRow } from "@/lib/xml/library-data"

// The `/` command (window 1's stub, 2026-09-14; the libraries, window 4): what
// a `/` query names in the corpus's address (docs/xml/schema.md), where it
// lives (`href`, the library or the Work that Enter opens), and what sits
// under it.
//
//   /119                         the 119th Congress's bills; its library
//   /6644, /hr6644               bills by number
//   /new-york-code, /us/usc      a code's titles, each a library
//   /new-york-constitution       the constitution's library
//   /agricultural-law            a family of law
//   /arkansas-agricultural-law   that family in one state
//   /new-york                    a jurisdiction's library
//   /agriculture                 codes whose names say so
//   /us/usc/t10/s130i            the Work in the XML view

export const dynamic = "force-dynamic"

export type SlashItem = { label: string; description: string; address: string | null; href: string | null; state: string | null }
export type SlashResponse = { target: SlashTarget | null; label: string; href: string | null; items: SlashItem[] }

type BillRow = { bill_id: number; bill_number: string; state: string; session_id: number; session_title: string | null; title: string | null }

const LIMIT = 20
const FEDERAL_LEGISCAN: Record<string, string> = { hr: "HB", s: "SB", hjres: "HJR", sjres: "SJR", hconres: "HCR", sconres: "SCR", hres: "HR", sres: "SR" }
const stateOf = (jurisdiction: string) => (jurisdiction === "us" ? "US" : jurisdiction.slice(3).toUpperCase())
const natural = (s: string) => s.replace(/\d+/g, (d) => d.padStart(12, "0"))

const billItem = (b: BillRow): SlashItem => ({
  label: fmtBill(b.bill_number, b.state),
  description: [b.session_title, b.title].filter(Boolean).join(" · "),
  address: billWork(b),
  href: typesetHref(b, "xml"),
  state: b.state,
})

// What a row holds, in a reader's word (Brendan, 2026-09-21: "why isn't it called 15 Sections"). "Work" is the
// schema's term for one addressable document (docs/xml/schema.md) and stays in the code; on screen a session
// holds bills and a code holds sections.
const held = (r: CatalogueRow) => `${r.works.toLocaleString("en-US")} ${r.kind === "bill" ? "bill" : "section"}${r.works === 1 ? "" : "s"}`

const rowItem = (r: CatalogueRow): SlashItem => ({
  label: codeName(r),
  description: `${jurisdictionName(r.jurisdiction)} · ${held(r)}`,
  address: r.prefix,
  href: libraryHref(r.prefix),
  state: stateOf(r.jurisdiction),
})

async function bills(where: string, params: unknown[], federalFirst = false): Promise<SlashItem[]> {
  // Typed in Congress's own letters ("hr 1", "hjres 2"), the bill meant is Congress's: its sessions lead, then the
  // states' bills the same letters reach. A bare number has no such claim, and runs newest session first.
  const rows = await q<BillRow>(
    `select bill_id, bill_number, state, session_id, session_title, title from "Bills" where ${where} order by ${federalFirst ? "(state = 'US') desc, " : ""}session_id desc, (state = 'US') desc, last_action_date desc nulls last limit ${LIMIT}`,
    params
  )
  return rows.map(billItem)
}

/** A slug that is not an address: a family, a family in a jurisdiction, a jurisdiction, or words in a code's name. */
async function library(slug: string): Promise<{ label: string; href: string | null; items: SlashItem[] }> {
  const rows = await loadCatalogue()
  const family = familyBySlug(slug)
  const scoped = family ? { family, jurisdiction: null as string | null } : jurisdictionFamily(slug)
  if (scoped) {
    const codes = familyCodes(rows, scoped.family, scoped.jurisdiction).sort((a, b) => b.works - a.works)
    const label = scoped.jurisdiction ? `${jurisdictionName(scoped.jurisdiction)} ${scoped.family.name}` : scoped.family.name
    return { label, href: libraryHref(slug), items: codes.slice(0, 40).map(rowItem) }
  }
  // A jurisdiction by its name, its address (`us-ma`) or its two letters (`ma`, `ny`). Until 2026-09-21 only the
  // name was known, so `/us-ma` and `/ny` fell through to the words below, which matched letters anywhere:
  // "us" and "ma" found B-us-iness codes in Ma-ryland, and "ny" found every Limited Liability Compa-ny act.
  const places = Object.keys(JURISDICTION_NAMES)
  const place = places.find((j) => jurisdictionSlug(j) === slug || j === slug || j === `us-${slug}`)
  if (place) return { label: jurisdictionName(place), href: libraryHref(place), items: rows.filter((r) => r.jurisdiction === place && r.kind !== "bill").sort((a, b) => b.works - a.works).slice(0, 40).map(rowItem) }
  // Part of one, still being typed (`/us-m`, `/new`): the jurisdictions it could become, A to Z, each a library.
  const becoming = places.filter((j) => j.startsWith(slug) || jurisdictionSlug(j).startsWith(slug)).sort((a, b) => jurisdictionName(a).localeCompare(jurisdictionName(b)))
  if (becoming.length && slug.length >= 2) {
    const sections = (j: string) => rows.filter((r) => r.jurisdiction === j && r.kind !== "bill").reduce((sum, r) => sum + r.works, 0)
    return {
      label: "Jurisdictions",
      href: null,
      items: becoming.map((j) => ({ label: jurisdictionName(j), description: `${sections(j).toLocaleString("en-US")} sections`, address: `/${j}`, href: libraryHref(j), state: stateOf(j) })),
    }
  }
  // Words in a code's name, each at the start of a word — "ny" is not in "Company".
  const words = slug.split("-").filter((w) => w.length > 1)
  const starts = (text: string, w: string) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text)
  const hits = words.length
    ? rows.filter((r) => r.kind !== "bill" && words.every((w) => starts(`${codeName(r)} ${jurisdictionName(r.jurisdiction)}`.toLowerCase(), w))).sort((a, b) => b.works - a.works)
    : []
  return { label: `Codes named “${words.join(" ")}”`, href: null, items: hits.slice(0, 40).map(rowItem) }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const input = params.get("q") ?? ""
  // `in` narrows a bill number to one jurisdiction (the search's `/809 /nj`, 2026-09-21): 809 is a bill in forty legislatures.
  const within = /^[A-Za-z]{2}$/.test(params.get("in") ?? "") ? (params.get("in") as string).toUpperCase() : null
  const target = resolveSlash(input)
  const reply = (label: string, href: string | null, items: SlashItem[]) => NextResponse.json({ target, label, href, items } satisfies SlashResponse)
  if (!target) return reply("", null, [])
  try {
    if (target.kind === "number") {
      const pattern = `^${target.type ? (FEDERAL_LEGISCAN[target.type] ?? target.type.toUpperCase()) : "[A-Z]+"}\\s*0*${target.number}$`
      // Congress first, then the newest session: `/hr1` used to lead with a state's HB 1 from a special session.
      const label = target.type ? target.label : `Bills numbered ${target.number}`
      return reply(within ? `${label} in ${jurisdictionName(within === "US" ? "us" : `us-${within.toLowerCase()}`)}` : label, null, await bills(within ? `bill_number ~* $1 and state = $2` : `bill_number ~* $1`, within ? [pattern, within] : [pattern], !!target.type && target.type in FEDERAL_LEGISCAN && target.type !== "s"))
    }
    if (target.kind === "library") {
      const found = await library(target.slug)
      return reply(found.label, found.href, found.items)
    }

    const address = target.kind === "address" ? target.address : parseAddress(target.prefix)
    if (!address) return reply(target.kind === "prefix" ? target.label : "", null, [])
    const jurisdiction = address.jurisdiction
    const state = stateOf(jurisdiction)
    const label = target.kind === "prefix" ? target.label : address.workAddress
    const segments = address.work.split("/").filter(Boolean)

    if (address.kind === "bill") {
      const [session, type, number] = segments
      if (!session) {
        const sessions = (await loadCatalogue()).filter((r) => r.jurisdiction === jurisdiction && r.kind === "bill").sort((a, b) => natural(b.unit).localeCompare(natural(a.unit)))
        return reply(`${jurisdictionName(jurisdiction)} sessions`, libraryHref(`${jurisdiction}/bill`), sessions.slice(0, 40).map(rowItem))
      }
      const year = state === "US" ? 1789 + (Number(session) - 1) * 2 : Number(session.replace(/s.*$/, ""))
      if (type && number) {
        const legiscan = state === "US" ? (FEDERAL_LEGISCAN[type] ?? type.toUpperCase()) : type.toUpperCase()
        const items = await bills(`state = $1 and session_id = $2 and bill_number ~* $3`, [state, year, `^${legiscan}\\s*0*${number}$`])
        return reply(label, workHref(formatAddress(address.workAddress, address.expression)), items)
      }
      return reply(`${label}: most recent action first`, libraryHref(`${jurisdiction}/bill/${session}`), await bills(`state = $1 and session_id = $2`, [state, year]))
    }

    if (address.kind === "code" || address.kind === "usc" || address.kind === "const") {
      const rows = await loadCatalogue()
      if (!segments.length) {
        if (address.kind === "const") {
          const row = rows.find((r) => r.prefix === `/${jurisdiction}/const`)
          return reply(`${jurisdictionName(jurisdiction)} Constitution`, row ? libraryHref(row.prefix) : null, row ? [rowItem(row)] : [])
        }
        const codes = rows.filter((r) => r.jurisdiction === jurisdiction && r.kind === address.kind).sort((a, b) => natural(a.unit).localeCompare(natural(b.unit)))
        return reply(label, libraryHref(`${jurisdiction}/${address.kind}`), codes.slice(0, 100).map(rowItem))
      }
      if (segments.length === 1 && address.kind !== "const") {
        const row = rows.find((r) => r.prefix === address.workAddress)
        if (row) return reply(codeName(row), libraryHref(row.prefix), [rowItem(row)])
      }
      const typed = formatAddress(address.workAddress, address.expression)
      const found = await findExpression(typed)
      if (found) {
        const item: SlashItem = { label: found.row.label ?? found.row.work, description: `${jurisdictionName(jurisdiction)} · as of ${found.row.expression_date}`, address: typed, href: workHref(typed), state }
        return reply(item.label, item.href, [item])
      }
      return reply(label, null, [])
    }
    return reply(address.workAddress, null, [])
  } catch (error) {
    return NextResponse.json({ target, label: "", href: null, items: [], error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
