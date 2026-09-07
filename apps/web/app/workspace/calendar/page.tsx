import type { Metadata } from "next"

import { CalendarWorkspace } from "@/components/workspace/calendar-workspace"

// /workspace/calendar — the calendar block as its own page of the workspace
// (Brendan, 2026-09-07): what the committees have calendared, as cards or a
// list, under the jurisdiction and session in scope.
export const metadata: Metadata = { title: "Calendar", description: "What the committees have calendared: every hearing under the jurisdiction and session in scope, as cards or a list." }

export default function CalendarPage() {
  return <CalendarWorkspace />
}
