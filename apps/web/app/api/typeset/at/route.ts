import { NextResponse } from "next/server"

import { memberHref } from "@/lib/filters"
import { q } from "@/lib/policy/db"
import { resolve, searchAll } from "@/lib/policy/db-queries"
import { federalSeat, legislativeBody } from "@/lib/legislative-body"
import { findExpression } from "@/lib/typeset/expression-document"
import { recognize, worksOf } from "@/lib/typeset/cite"
import { resolveWorks } from "@/lib/typeset/resolve"
import { parseAddress } from "@/lib/xml/address"
import { workHref } from "@/lib/xml/library"

// The `@` command (window 6, 2026-09-14): references, in one palette. A
// citation typed the way law is written ("10 U.S.C. 130i", "section 16 of
// the agriculture and markets law", an address) resolves through the address
// scheme to a Work in the corpus; members and committees come from the
// "People" and "Committees" the site already has. The ⌘K menu opens what is
// chosen; the Fork view's editor inserts it as a reference.
//
//   GET /api/typeset/at?q=10 usc 130i[&jurisdiction=us-ny][&state=NY]

export const dynamic = "force-dynamic"

export type AtItem = {
  kind: "citation" | "member" | "committee"
  /** A member's chamber and party, for the seal before the body's name and the dot in place of the letter. */
  chamber?: string | null
  party?: string | null
  label: string
  detail: string | null
  /** Where the item opens. */
  href: string | null
  /** What the editor inserts: the words, and the address or page a `ref` carries. */
  insert: { text: string; href: string | null }
  state: string | null
}

export type AtResponse = { citations: AtItem[]; members: AtItem[]; committees: AtItem[] }

/** "10 usc 130i" and "10 USC § 130i" as the recognizer reads them. */
const normalise = (text: string) => text.replace(/\bu\.?\s?s\.?\s?c\.?(?=\s|$)/gi, "U.S.C.").replace(/\bpl\s+(\d+)/gi, "Public Law $1")

async function citations(text: string, jurisdiction: string): Promise<AtItem[]> {
  if (text.startsWith("/")) {
    const address = parseAddress(text)
    const found = address ? await findExpression(text).catch(() => null) : null
    if (!found) return []
    return [{ kind: "citation", label: found.row.label ?? found.row.work, detail: `as of ${found.row.expression_date}`, href: workHref(text), insert: { text: found.row.label ?? text, href: text }, state: null }]
  }
  const words = normalise(text)
  // The citing jurisdiction's reading, then New York's own forms from anywhere; each Work once.
  const found = [...recognize(words, { jurisdiction }), ...(jurisdiction === "us-ny" ? [] : recognize(words, { jurisdiction: "us-ny" }).filter((c) => c.kind === "code"))]
  const seen = new Set<string>()
  const cites = found.filter((c) => c.work && !seen.has(c.address ?? c.work) && seen.add(c.address ?? c.work))
  if (!cites.length) return []
  const resolved = await resolveWorks(worksOf(cites.map((c) => ({ ...c, via: "text" as const }))), null)
  return cites.map((c) => {
    const r = resolved[c.work!]
    return {
      kind: "citation",
      label: c.text,
      detail: r?.found ? `${r.label ?? c.work} · as of ${r.latest}` : "Not in the corpus yet",
      href: r?.found ? workHref(c.address ?? c.work!) : null,
      insert: { text: c.text, href: c.address ?? c.work },
      state: null,
    }
  })
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const text = (sp.get("q") ?? "").replace(/^@/, "").trim()
  const jurisdiction = sp.get("jurisdiction") ?? "us"
  const state = (sp.get("state") ?? "").toUpperCase() || null
  // `in` narrows members and committees to one jurisdiction (the search's `@martinez /ny`, 2026-09-21); `state` only orders.
  const within = /^[A-Za-z]{2}$/.test(sp.get("in") ?? "") ? (sp.get("in") as string).toUpperCase() : null
  if (text.length < 2) return NextResponse.json({ citations: [], members: [], committees: [] } satisfies AtResponse)
  try {
    // Members and committees are the site search's own (Brendan, 2026-09-21).
    // This route used to ask "People" by name and the "Committees" table
    // itself, and both were wrong: LegiScan files some committees as people
    // (462 rows in 23 states, more with no name in two parts), so "@jud" listed
    // Oregon's Committee On Judiciary as a member; and "Committees" is the 82
    // New York committees the site began with, so a reader who had not signed
    // in was shown the New York Assembly's and nobody else's. searchAll had
    // already solved both — the member filter, and committees from every
    // jurisdiction's current session, Congress first — so there is one answer.
    // Every row carries its jurisdiction, for its flag and for the gate: a row
    // opens its own jurisdiction's page, where a reader it is closed to meets
    // the door (lib/entitlements.ts), rather than being hidden here.
    const f = await resolve({ state: within ?? state ?? "US" })
    const [cites, found] = await Promise.all([citations(text, jurisdiction), searchAll(f, text, within ? 40 : 8, { all: !within })])
    if (within) found.members = found.members.filter((p) => p.state === within)
    return NextResponse.json({
      citations: cites,
      members: found.members.slice(0, 8).map((p) => {
        const href = memberHref(p.people_id, p.state ?? undefined)
        // A member of Congress says where from: "U.S. Senate, NY", "U.S. House, NY-14" (Brendan, 2026-09-21).
        const body = (p.state ? legislativeBody(p.state, p.chamber ?? "") : p.chamber) || null
        return { kind: "member" as const, chamber: p.chamber ?? null, party: p.party ?? null, label: p.name, detail: [body, federalSeat(p.district)].filter(Boolean).join(", ") || null, href, insert: { text: p.name, href }, state: p.state }
      }),
      committees: found.committees.slice(0, 12).map((c) => {
        const href = `/bills?state=${c.state}&committee=${encodeURIComponent(c.committee)}`
        return { kind: "committee" as const, label: c.committee, detail: [legislativeBody(c.state, c.chamber ?? ""), `${c.bills.toLocaleString("en-US")} bills`].filter(Boolean).join(" · "), href, insert: { text: c.committee, href }, state: c.state }
      }),
    } satisfies AtResponse)
  } catch (error) {
    return NextResponse.json({ citations: [], members: [], committees: [], error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
