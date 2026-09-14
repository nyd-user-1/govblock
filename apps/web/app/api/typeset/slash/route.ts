import { NextResponse } from "next/server"

import { fmtBill } from "@/lib/format"
import { q } from "@/lib/policy/db"
import { typesetHref } from "@/lib/typeset/views"
import { billWork, parseAddress, resolveSlash, type SlashTarget } from "@/lib/xml/address"

// The `/` command, stubbed (window 1, 2026-09-14): what a `/` query names in
// the corpus's address (docs/xml/schema.md), and the Works under it. A
// session and a bill number resolve here; a state's code lists its laws; a
// named library by family of law is window 4's and comes back as itself.
//
//   GET /api/typeset/slash?q=/119   /6644   /hr6644   /new-york-code   /us/bill/119/hr/6644

export const dynamic = "force-dynamic"

export type SlashItem = { label: string; description: string; address: string | null; href: string | null; state: string | null }
export type SlashResponse = { target: SlashTarget | null; label: string; items: SlashItem[] }

type BillRow = { bill_id: number; bill_number: string; state: string; session_id: number; session_title: string | null; title: string | null }

const LIMIT = 20
const FEDERAL_LEGISCAN: Record<string, string> = { hr: "HB", s: "SB", hjres: "HJR", sjres: "SJR", hconres: "HCR", sconres: "SCR", hres: "HR", sres: "SR" }

const billItem = (b: BillRow): SlashItem => ({
  label: fmtBill(b.bill_number, b.state),
  description: [b.session_title, b.title].filter(Boolean).join(" · "),
  address: billWork(b),
  href: typesetHref(b.bill_id, "xml"),
  state: b.state,
})

async function bills(where: string, params: unknown[]): Promise<SlashItem[]> {
  const rows = await q<BillRow>(
    `select bill_id, bill_number, state, session_id, session_title, title from "Bills" where ${where} order by session_id desc, last_action_date desc nulls last limit ${LIMIT}`,
    params
  )
  return rows.map(billItem)
}

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("q") ?? ""
  const target = resolveSlash(input)
  if (!target) return NextResponse.json({ target: null, label: "", items: [] } satisfies SlashResponse)
  try {
    if (target.kind === "number") {
      const pattern = `^${target.type ? (FEDERAL_LEGISCAN[target.type] ?? target.type.toUpperCase()) : "[A-Z]+"}\\s*0*${target.number}$`
      return NextResponse.json({ target, label: target.type ? target.label : `Bills numbered ${target.number}`, items: await bills(`bill_number ~* $1`, [pattern]) } satisfies SlashResponse)
    }
    if (target.kind === "prefix" || target.kind === "address") {
      const address = target.kind === "address" ? target.address : parseAddress(target.prefix)
      if (!address) return NextResponse.json({ target, label: target.kind === "prefix" ? target.label : "", items: [] } satisfies SlashResponse)
      const state = address.jurisdiction === "us" ? "US" : address.jurisdiction.slice(3).toUpperCase()
      const [session, type, number] = address.work.split("/")
      if (address.kind === "bill") {
        const year = state === "US" && session ? 1789 + (Number(session) - 1) * 2 : Number(String(session ?? "").replace(/s.*$/, ""))
        const label = target.kind === "prefix" ? target.label : address.workAddress
        if (!session) return NextResponse.json({ target, label, items: await bills(`state = $1`, [state]) } satisfies SlashResponse)
        if (type && number) {
          const legiscan = state === "US" ? (FEDERAL_LEGISCAN[type] ?? type.toUpperCase()) : type.toUpperCase()
          return NextResponse.json({ target, label, items: await bills(`state = $1 and session_id = $2 and bill_number ~* $3`, [state, year, `^${legiscan}\\s*0*${number}$`]) } satisfies SlashResponse)
        }
        return NextResponse.json({ target, label: `${label}: most recent action first`, items: await bills(`state = $1 and session_id = $2`, [state, year]) } satisfies SlashResponse)
      }
      if (address.kind === "code" || address.kind === "usc" || address.kind === "const") {
        const laws = await q<{ law_id: string; law_name: string | null; law_type: string | null }>(
          `select law_id, max(law_name) as law_name, max(law_type) as law_type from "Laws" where state = $1 and depth = 0 group by law_id order by law_id limit 200`,
          [state]
        )
        const prefix = `/${address.jurisdiction}/${address.kind}`
        const items = laws
          .filter((l) => (address.kind === "const" ? /constitution/i.test(l.law_name ?? "") : !/constitution/i.test(l.law_name ?? "")))
          .map((l): SlashItem => ({ label: l.law_name ?? l.law_id, description: l.law_id, address: `${prefix}/${state === "US" ? l.law_id.replace(/^USC0*/i, "t").toLowerCase() : l.law_id.toLowerCase()}`, href: `/laws?state=${state}&law=${encodeURIComponent(l.law_id)}`, state }))
        return NextResponse.json({ target, label: target.kind === "prefix" ? target.label : address.workAddress, items: items.slice(0, LIMIT * 5) } satisfies SlashResponse)
      }
      return NextResponse.json({ target, label: address.workAddress, items: [] } satisfies SlashResponse)
    }
    return NextResponse.json({ target, label: target.label, items: [] } satisfies SlashResponse)
  } catch (error) {
    return NextResponse.json({ target, label: "", items: [], error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
