import { NextResponse } from "next/server"

import { isJurisdiction, readFilters, stateName } from "@/lib/filters"
import { fmtBill, fmtDate } from "@/lib/format"
import { getBills, resolve } from "@/lib/policy/queries"
import { JURISDICTIONS } from "@/components/library/jurisdiction-index"

// "View as Markdown" (the Copy Page menu) opens the page's address with .md
// on the end, as shadcn's docs do. Nothing served it until 2026-09-11
// (Brendan: "view as markdown doesn't work"): next.config rewrites
// `/anything.md` here, and this answers with the page as markdown for the
// pages that have one. A page without one says so, in plain text, rather
// than 404ing the way the app's own not-found page does.

export const revalidate = 3600

const SITE = "https://gov.nysgpt.com"

const name = (state: string) => (state === "US" ? "U.S. Congress" : stateName(state))

function jurisdictionIndex(title: string, description: string, base: string) {
  const lines = [`# ${title}`, "", description, ""]
  const rows = [...JURISDICTIONS.filter((j) => j.code === "US"), ...JURISDICTIONS.filter((j) => j.code !== "US")]
  for (const j of rows) lines.push(`- [${j.name}](${SITE}${base}/${j.code.toLowerCase()})`)
  return lines.join("\n") + "\n"
}
const billsIndex = () => jurisdictionIndex("Bills", "Every jurisdiction with a record: Congress, the fifty states and the District, each with its bills and their full text.", "/bills")
const deskIndex = () => jurisdictionIndex("Desk", "What each legislature did, newest first: a desk for every jurisdiction with a record.", "/desk")

async function billsFor(state: string) {
  const f = await resolve(readFilters(new URLSearchParams({ state })))
  const { rows, total } = await getBills(f, 50, 0)
  const lines = [`# ${name(state)} Bills`, "", `The bills most recently acted on in ${state === "US" ? "Congress" : name(state)}, each with its full text.${total > rows.length ? ` ${total.toLocaleString("en-US")} on file; the ${rows.length} most recent follow.` : ""}`, ""]
  for (const b of rows) {
    const when = b.last_action_date ? fmtDate(b.last_action_date) : ""
    const meta = [when, b.status_desc, b.committee, b.sponsor].filter(Boolean).join(" · ")
    lines.push(`- **[${fmtBill(b.bill_number, state)}](${SITE}/bills/${b.bill_id})**${meta ? ` · ${meta}` : ""}`)
    if (b.title) lines.push(`  ${b.title}`)
  }
  return lines.join("\n") + "\n"
}

const markdown = (body: string, status = 200) => new NextResponse(body, { status, headers: { "content-type": "text/markdown; charset=utf-8" } })

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const [head, second, ...rest] = path
  if (head === "bills" && !second) return markdown(billsIndex())
  if (head === "desk" && !second) return markdown(deskIndex())
  if (head === "bills" && second && !rest.length && /^[a-z]{2}$/i.test(second) && isJurisdiction(second)) return markdown(await billsFor(second.toUpperCase()))
  return new NextResponse(`No markdown for /${path.join("/")} yet.\n`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } })
}
