"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { SessionsCardBody, type SessionRow } from "@/components/cards/sessions-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Sessions, on the home page — the picker. Choosing one scopes every other
// card; the current one is marked.
type ApiSession = { session_id: number; bills: number; title: string }

export function SessionsCard() {
  const { data, session, state, congress } = useScoped<ApiSession[]>("sessions", null as unknown as ApiSession[], { titles: 1 })
  const sessions = React.useMemo<SessionRow[]>(
    () =>
      data
        ? data.map((row) => ({
            session_year: row.session_id,
            label: row.title,
            // The span when the title carries one ("2025-2026 Regular Session"),
            // otherwise the year the session opened.
            years: row.title.match(/\d{4}-\d{4}/)?.[0] ?? String(row.session_id),
            bills: row.bills,
          }))
        : congress
          ? F.sessions
          : [],
    [data, congress]
  )
  return (
    <CardFrame id="sessions">
      <SessionsCardBody rows={sessions} current={session} state={state} title={<CardAnchor>Sessions</CardAnchor>} action={<ComponentActions rows={sessions} id="sessions" />} href={`/docs/datasets/${state.toLowerCase()}`} />
    </CardFrame>
  )
}
