import { NextResponse } from "next/server"

import { q } from "@/lib/policy/db"
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
  const found = [...recognize(words, { jurisdiction }), ...(jurisdiction === "us-ny" ? [] : recognize(words, { jurisdiction: "us-ny" }))]
  const cites = found.filter((c) => c.work)
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
  if (text.length < 2) return NextResponse.json({ citations: [], members: [], committees: [] } satisfies AtResponse)
  const like = `%${text.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
  try {
    const [cites, people, committees] = await Promise.all([
      citations(text, jurisdiction),
      q<{ people_id: number; name: string; party: string | null; role: string | null; chamber: string | null; state: string | null }>(
        `select people_id, name, party, role, chamber, state from "People" where name ilike $1 order by (state = $2) desc nulls last, name limit 8`,
        [like, state]
      ),
      q<{ committee_id: number; committee_name: string; chamber: string | null; slug: string | null }>(
        `select committee_id, committee_name, chamber, slug from "Committees" where committee_name ilike $1 order by committee_name limit 6`,
        [like]
      ),
    ])
    return NextResponse.json({
      citations: cites,
      members: people.map((p) => ({ kind: "member", label: p.name, detail: [p.role, p.chamber, p.party, p.state].filter(Boolean).join(" · ") || null, href: `/members/${p.people_id}`, insert: { text: p.name, href: `/members/${p.people_id}` }, state: p.state })),
      committees: committees.map((c) => ({ kind: "committee", label: c.committee_name, detail: c.chamber, href: c.slug ? `/committees/${c.slug}` : null, insert: { text: c.committee_name, href: c.slug ? `/committees/${c.slug}` : null }, state: null })),
    } satisfies AtResponse)
  } catch (error) {
    return NextResponse.json({ citations: [], members: [], committees: [], error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
