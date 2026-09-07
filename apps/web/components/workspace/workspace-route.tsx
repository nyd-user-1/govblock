"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { PathScopeContext, type PathScope } from "@/lib/policy/jurisdiction"
import type { Bill, SessionRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { parseWorkspacePath, slugify } from "@/lib/workspace/path"
import { Designer, type DesignerRoute } from "@/components/create/designer"

// /workspace/data/… (Brendan, 2026-09-07): the path, read, resolved, and
// handed to the designer. The session is the path's or the newest with
// bills; a bill named by its number and a committee named by its slug are
// looked up before the stage draws. The path's state, session and chamber
// reach every hook on the page through PathScopeContext.

type Committee = { committee_name: string; chamber: string; bills: number }

export function WorkspaceRoute({ segments }: { segments: string[] }) {
  const parsed = React.useMemo(() => parseWorkspacePath(segments), [segments])
  const node = parsed.kind === "node" ? parsed : null

  const { data: sessions } = usePolicy<SessionRow[]>(node ? "sessions" : null, { state: node?.state })
  // A year in the path is the dataset whose span covers it: 2026 reads the
  // 119th Congress, keyed 2025, since two-year legislatures are keyed by the
  // year they began. Absent, the newest year with bills.
  const session = React.useMemo(() => {
    if (!node) return null
    const rows = sessions ?? []
    if (node.session) {
      if (!rows.length || rows.some((r) => Number(r.session_id) === node.session)) return node.session
      const covering = rows.map((r) => Number(r.session_id)).filter((y) => y <= node.session!).sort((a, b) => b - a)[0]
      return covering ?? node.session
    }
    const pick = rows.find((r) => Number(r.bills) > 0) ?? rows[0]
    return pick ? Number(pick.session_id) : null
  }, [node, sessions])

  const wantsBill = !!node?.billNumber && !!session
  const { data: bill } = usePolicy<Bill>(wantsBill ? "bill" : null, { state: node?.state, session: session ? String(session) : undefined }, { number: node?.billNumber })
  const wantsCommittee = !!node?.committeeSlug && !!session
  const { data: committees } = usePolicy<Committee[]>(wantsCommittee ? "committees" : null, { state: node?.state, session: session ? String(session) : undefined })
  const committee = React.useMemo(() => (node?.committeeSlug ? committees?.find((c) => slugify(c.committee_name) === node.committeeSlug && (!node.chamber || c.chamber === node.chamber)) ?? committees?.find((c) => slugify(c.committee_name) === node.committeeSlug) : undefined), [committees, node])

  if (parsed.kind === "datasets") return <Designer route={{ datasets: true }} />
  if (parsed.kind === "missing" || !node) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
        <p className="text-lg font-medium">Nothing lives here.</p>
        <p className="text-sm text-muted-foreground">{parsed.kind === "missing" ? parsed.reason : ""}</p>
      </div>
    )
  }

  const pending = !session || (wantsBill && !bill) || (wantsCommittee && !committee)
  const location = { ...node.location }
  if (bill && wantsBill) location.bill = String(bill.bill_id)
  if (committee && wantsCommittee) location.committee = committee.committee_name
  const scope: PathScope = { state: node.state, session, chamber: node.chamber, sessions: sessions ?? [] }
  const route: DesignerRoute = { state: node.state, chamber: node.chamber, session, location, pending }

  return (
    <PathScopeContext.Provider value={scope}>
      <title>{`${stateName(node.state)} ${node.chamber}`}</title>
      <Designer route={route} />
    </PathScopeContext.Provider>
  )
}
